const DEFAULT_TRANSLATION_TIMEOUT_MS = 2500;
const GOOGLE_TRANSLATE_LOCATION = "global";

function getGoogleCloudProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    ""
  );
}

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

async function getGoogleMetadataAccessToken(fetchFn, timeoutMs = DEFAULT_TRANSLATION_TIMEOUT_MS) {
  const { controller, timeout } = buildTimeoutSignal(timeoutMs);

  try {
    const response = await fetchFn(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: controller.signal,
      }
    );

    if (!response?.ok) return null;

    const data = await response.json();
    return typeof data?.access_token === "string" && data.access_token.trim()
      ? data.access_token.trim()
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateWithGoogleCloudTranslation({
  text,
  targetLang,
  fetchFn = fetch,
  timeoutMs = DEFAULT_TRANSLATION_TIMEOUT_MS,
  projectId = getGoogleCloudProjectId(),
  getAccessTokenFn = getGoogleMetadataAccessToken,
  logger = console,
} = {}) {
  const sourceText = typeof text === "string" ? text : "";
  const lang = typeof targetLang === "string" ? targetLang.trim().toLowerCase() : "";

  if (!sourceText.trim()) {
    return { ok: false, text: sourceText, error: "empty-text" };
  }

  if (!lang) {
    return { ok: false, text: sourceText, error: "missing-target-lang" };
  }

  if (!projectId) {
    return { ok: false, text: sourceText, error: "missing-project-id" };
  }

  try {
    const accessToken = await getAccessTokenFn(fetchFn, timeoutMs);
    if (!accessToken) {
      return { ok: false, text: sourceText, error: "missing-access-token" };
    }

    const { controller, timeout } = buildTimeoutSignal(timeoutMs);

    try {
      const response = await fetchFn(
        `https://translation.googleapis.com/v3/projects/${encodeURIComponent(
          projectId
        )}/locations/${GOOGLE_TRANSLATE_LOCATION}:translateText`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [sourceText],
            mimeType: "text/plain",
            targetLanguageCode: lang,
          }),
          signal: controller.signal,
        }
      );

      if (!response?.ok) {
        return { ok: false, text: sourceText, error: `http-${response?.status || "error"}` };
      }

      const data = await response.json();
      const translatedText = data?.translations?.[0]?.translatedText;
      const detectedSourceLang = data?.translations?.[0]?.detectedLanguageCode || "";

      if (typeof translatedText !== "string" || !translatedText.trim()) {
        return { ok: false, text: sourceText, error: "empty-provider-response" };
      }

      return {
        ok: true,
        text: translatedText,
        detectedSourceLang,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    logger.warn?.("[aemetTranslations] provider fallback", {
      error: error?.name === "AbortError" ? "timeout" : error?.message || String(error),
    });
    return {
      ok: false,
      text: sourceText,
      error: error?.name === "AbortError" ? "timeout" : "provider-error",
    };
  }
}

module.exports = {
  DEFAULT_TRANSLATION_TIMEOUT_MS,
  getGoogleCloudProjectId,
  getGoogleMetadataAccessToken,
  translateWithGoogleCloudTranslation,
};
