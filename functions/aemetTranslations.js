const crypto = require("node:crypto");
const { translateWithGoogleCloudTranslation } = require("./translationProvider");

const AEMET_TRANSLATIONS_COLLECTION = "aemetTranslations";
const AEMET_TRANSLATION_CACHE_VERSION = "v2";
const SUPPORTED_AEMET_TRANSLATION_LANGS = new Set(["ca", "es", "eu", "gl", "en"]);
const PLACEHOLDER_PREFIX = "__TS_TOKEN_";
const MAX_AEMET_TRANSLATION_TEXT_LENGTH = 1200;
const pendingTranslations = new Map();

function normalizeAemetTranslationCacheText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function normalizeTargetLang(targetLang) {
  const lang = String(targetLang || "").trim().toLowerCase().slice(0, 2);
  return SUPPORTED_AEMET_TRANSLATION_LANGS.has(lang) ? lang : "";
}

function buildAemetTranslationCacheKey(text, targetLang) {
  const normalizedText = normalizeAemetTranslationCacheText(text);
  const lang = normalizeTargetLang(targetLang);
  const sourceHash = crypto
    .createHash("sha256")
    .update(`${AEMET_TRANSLATION_CACHE_VERSION}|${normalizedText}|${lang}`)
    .digest("hex");

  return {
    key: sourceHash,
    sourceHash,
    cacheVersion: AEMET_TRANSLATION_CACHE_VERSION,
    normalizedText,
    targetLang: lang,
  };
}

function protectAemetDescriptionTokens(text) {
  const tokens = [];
  const source = String(text || "");
  const tokenPattern =
    /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}:\d{2}\b|-?\d+(?:[.,]\d+)?(?:\s*-\s*-?\d+(?:[.,]\d+)?)?\s*°\s*C\b|-?\d+(?:[.,]\d+)?(?:\s*-\s*-?\d+(?:[.,]\d+)?)?\s*º\s*C\b|\b\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*km\/h\b|\b\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(?:mm|cm|m\/s|hPa|l\/m2|l\/m²)\b|\b\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*%/gi;

  const protectedText = source.replace(tokenPattern, (match) => {
    const placeholder = `${PLACEHOLDER_PREFIX}${tokens.length}__`;
    tokens.push({ placeholder, value: match });
    return placeholder;
  });

  return { text: protectedText, tokens };
}

function restoreAemetDescriptionTokens(text, tokens = []) {
  let restored = String(text || "");

  for (const token of tokens) {
    restored = restored.split(token.placeholder).join(token.value);
  }

  return restored;
}

function validateAemetDescriptionTokens(text, tokens = []) {
  const result = String(text || "");
  const missingTokens = tokens
    .filter((token) => !result.includes(token.value))
    .map((token) => token.value);
  const residualPlaceholders = new RegExp(`${PLACEHOLDER_PREFIX}\\d+__`).test(result);
  const valid = missingTokens.length === 0 && !residualPlaceholders;

  return {
    valid,
    missingTokens,
    residualPlaceholders,
    tokenCount: tokens.length,
  };
}

function buildOriginalResult(text, source = "original", reason = "") {
  return {
    text: String(text || ""),
    source,
    cached: false,
    valid: false,
    reason,
  };
}

function isAemetAutoTranslationEnabled(value = process.env.AEMET_AUTO_TRANSLATION_ENABLED) {
  return String(value || "").trim().toLowerCase() === "true";
}

function getCacheDoc(db, key) {
  return db.collection(AEMET_TRANSLATIONS_COLLECTION).doc(key);
}

function getHeader(req, name) {
  const direct = req.get?.(name);
  if (direct) return direct;

  const headers = req.headers || {};
  return headers[name.toLowerCase()] || headers[name] || "";
}

function isJsonContentType(req) {
  const contentType = String(getHeader(req, "content-type") || "").toLowerCase();
  return contentType.split(";")[0].trim() === "application/json";
}

function getAppCheckTokenFromRequest(req) {
  return String(getHeader(req, "x-firebase-appcheck") || "").trim();
}

async function verifyAemetAppCheckRequest(req, verifyAppCheckToken) {
  const token = getAppCheckTokenFromRequest(req);
  if (!token) return { ok: false, status: 401, reason: "missing-app-check-token" };
  if (typeof verifyAppCheckToken !== "function") {
    return { ok: false, status: 403, reason: "missing-app-check-verifier" };
  }

  try {
    await verifyAppCheckToken(token);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      status: 403,
      reason: "invalid-app-check-token",
      error: error?.message || String(error),
    };
  }
}

async function runAemetTranslation({
  text,
  targetLang,
  db,
  translateFn = translateWithGoogleCloudTranslation,
  now = new Date(),
  logger = console,
} = {}) {
  const originalText = String(text || "");
  const lang = normalizeTargetLang(targetLang);

  if (!originalText.trim()) return buildOriginalResult(originalText, "original", "empty-text");
  if (!lang) return buildOriginalResult(originalText, "original", "unsupported-lang");
  if (!db || typeof db.collection !== "function") {
    return buildOriginalResult(originalText, "original", "missing-db");
  }

  const { key, sourceHash, normalizedText } = buildAemetTranslationCacheKey(originalText, lang);
  const docRef = getCacheDoc(db, key);
  const nowValue = now instanceof Date ? now : new Date(now);

  try {
    const snap = await docRef.get();
    if (snap?.exists) {
      const data = snap.data?.() || {};
      if (typeof data.translatedText === "string" && data.translatedText.trim()) {
        logger.log?.("[aemetTranslations] cache hit", { targetLang: lang, key });
        return {
          text: data.translatedText,
          source: "cache",
          cached: true,
          valid: true,
          key,
        };
      }
    }
  } catch (error) {
    logger.warn?.("[aemetTranslations] cache read failed", {
      key,
      error: error?.message || String(error),
    });
  }

  logger.log?.("[aemetTranslations] cache miss", { targetLang: lang, key });

  const protectedResult = protectAemetDescriptionTokens(normalizedText);
  let providerResult;

  try {
    providerResult = await translateFn({
      text: protectedResult.text,
      targetLang: lang,
    });
  } catch (error) {
    logger.warn?.("[aemetTranslations] provider threw", {
      key,
      error: error?.message || String(error),
    });
    return buildOriginalResult(originalText, "original", "provider-error");
  }

  if (!providerResult?.ok || typeof providerResult.text !== "string" || !providerResult.text.trim()) {
    logger.warn?.("[aemetTranslations] provider fallback", {
      key,
      reason: providerResult?.error || "empty-provider-response",
    });
    return buildOriginalResult(originalText, "original", providerResult?.error || "provider-error");
  }

  const restoredText = restoreAemetDescriptionTokens(providerResult.text, protectedResult.tokens);
  const tokenValidation = validateAemetDescriptionTokens(restoredText, protectedResult.tokens);

  if (!tokenValidation.valid) {
    logger.warn?.("[aemetTranslations] token validation failed", {
      key,
      tokenValidation,
    });
    return buildOriginalResult(originalText, "original", "token-validation-failed");
  }

  const translatedText = restoredText.trim();

  try {
    await docRef.set(
      {
        sourceText: normalizedText,
        sourceHash,
        targetLang: lang,
        translatedText,
        provider: providerResult.provider || "google-cloud-translation",
        createdAt: nowValue,
        updatedAt: nowValue,
        lastUsedAt: nowValue,
        status: "ok",
        tokenValidation,
      },
      { merge: true }
    );
  } catch (error) {
    logger.warn?.("[aemetTranslations] cache write failed", {
      key,
      error: error?.message || String(error),
    });
  }

  logger.log?.("[aemetTranslations] provider success", { targetLang: lang, key });
  return {
    text: translatedText,
    source: "provider",
    cached: false,
    valid: true,
    key,
  };
}

async function translateAemetDescription(options = {}) {
  const lang = normalizeTargetLang(options.targetLang);
  const originalText = String(options.text || "");

  if (!originalText.trim()) return buildOriginalResult(originalText, "original", "empty-text");
  if (!lang) return buildOriginalResult(originalText, "original", "unsupported-lang");

  const { key } = buildAemetTranslationCacheKey(originalText, lang);

  if (pendingTranslations.has(key)) {
    return pendingTranslations.get(key);
  }

  const promise = runAemetTranslation({ ...options, targetLang: lang }).finally(() => {
    pendingTranslations.delete(key);
  });
  pendingTranslations.set(key, promise);
  return promise;
}

async function handleAemetTranslationRequest(req, res, options = {}) {
  const logger = options.logger || console;

  try {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        text: "",
        source: "original",
        cached: false,
        valid: false,
      });
    }

    if (!isJsonContentType(req)) {
      return res.status(415).json({
        text: "",
        source: "original",
        cached: false,
        valid: false,
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const text = typeof body.text === "string" ? body.text : "";
    const targetLang = normalizeTargetLang(body.targetLang);

    if (!isAemetAutoTranslationEnabled(options.enabled)) {
      return res.json({
        text,
        source: "original",
        cached: false,
        valid: false,
      });
    }

    const appCheck = await verifyAemetAppCheckRequest(req, options.verifyAppCheckToken);
    if (!appCheck.ok) {
      logger.warn?.("[aemetTranslations] app check rejected", {
        status: appCheck.status,
        reason: appCheck.reason,
      });
      return res.status(appCheck.status).json({
        text,
        source: "original",
        cached: false,
        valid: false,
      });
    }

    if (!text.trim() || !targetLang || text.length > MAX_AEMET_TRANSLATION_TEXT_LENGTH) {
      return res.json({
        text,
        source: "original",
        cached: false,
        valid: false,
      });
    }

    const result = await translateAemetDescription({
      text,
      targetLang,
      db: options.db,
      translateFn: options.translateFn,
      now: options.now,
      logger,
    });

    return res.json({
      text: result.text,
      source: result.source,
      cached: result.cached,
      valid: result.valid,
    });
  } catch (error) {
    logger.warn?.("[aemetTranslations] endpoint fallback", {
      error: error?.message || String(error),
    });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    return res.json({
      text: typeof body.text === "string" ? body.text : "",
      source: "original",
      cached: false,
      valid: false,
    });
  }
}

module.exports = {
  AEMET_TRANSLATIONS_COLLECTION,
  AEMET_TRANSLATION_CACHE_VERSION,
  MAX_AEMET_TRANSLATION_TEXT_LENGTH,
  SUPPORTED_AEMET_TRANSLATION_LANGS,
  buildAemetTranslationCacheKey,
  getAppCheckTokenFromRequest,
  handleAemetTranslationRequest,
  isAemetAutoTranslationEnabled,
  isJsonContentType,
  normalizeAemetTranslationCacheText,
  normalizeTargetLang,
  protectAemetDescriptionTokens,
  restoreAemetDescriptionTokens,
  translateAemetDescription,
  validateAemetDescriptionTokens,
};
