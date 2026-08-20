import type { LangKey } from "../utils/aemetAi";
import { getApps, initializeApp } from "firebase/app";
import { firebaseConfig } from "../firebaseConfig";

export type AemetDescriptionTranslationResult = {
  text: string;
  source: "cache" | "provider" | "original";
  cached: boolean;
  valid: boolean;
};

const DEFAULT_AEMET_TRANSLATION_ENDPOINT =
  "https://europe-west1-thermosafe-58f46.cloudfunctions.net/translateAemetDescription";

const memoryCache = new Map<string, AemetDescriptionTranslationResult>();
const pendingRequests = new Map<string, Promise<AemetDescriptionTranslationResult>>();
let appCheckInstancePromise: Promise<unknown> | null = null;

function getClientEnv() {
  return import.meta.env || {};
}

export function isAemetAutoTranslationEnabled(): boolean {
  return getClientEnv().VITE_AEMET_AUTO_TRANSLATION_ENABLED === "true";
}

export function getAemetTranslationEndpoint(): string {
  return (
    getClientEnv().VITE_AEMET_TRANSLATION_ENDPOINT ||
    DEFAULT_AEMET_TRANSLATION_ENDPOINT
  );
}

function getAemetAppCheckSiteKey(): string {
  return getClientEnv().VITE_FIREBASE_APPCHECK_SITE_KEY || "";
}

export function buildAemetDescriptionTranslationKey(text: string, targetLang: LangKey): string {
  return `${text}|${targetLang}`;
}

export function clearAemetDescriptionTranslationSessionCache() {
  memoryCache.clear();
  pendingRequests.clear();
}

async function getAemetTranslationAppCheckToken(): Promise<string> {
  const siteKey = getAemetAppCheckSiteKey();
  console.log("[AEMET-TRANSLATION] app check token requested", {
    hasSiteKey: Boolean(siteKey),
  });
  if (!siteKey || typeof window === "undefined") return "";

  try {
    const { ReCaptchaV3Provider, getToken, initializeAppCheck } = await import("firebase/app-check");

    if (!appCheckInstancePromise) {
      const firebaseApp = getApps()[0] || initializeApp(firebaseConfig);
      appCheckInstancePromise = Promise.resolve(
        initializeAppCheck(firebaseApp, {
          provider: new ReCaptchaV3Provider(siteKey),
          isTokenAutoRefreshEnabled: true,
        })
      );
    }

    const appCheck = await appCheckInstancePromise;
    const tokenResult = await getToken(appCheck as Parameters<typeof getToken>[0], false);
    console.log("[AEMET-TRANSLATION] app check token obtained", {
      obtained: Boolean(tokenResult.token),
    });
    return tokenResult.token || "";
  } catch (error) {
    console.warn("[AEMET-TRANSLATION] app check token error", {
      name: error instanceof Error ? error.name : undefined,
      code:
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
    appCheckInstancePromise = null;
    return "";
  }
}

export async function translateAemetDescriptionForUi(
  text: string,
  targetLang: LangKey,
  options: {
    enabled?: boolean;
    endpoint?: string;
    fetchFn?: typeof fetch;
    getAppCheckTokenFn?: () => Promise<string>;
  } = {}
): Promise<AemetDescriptionTranslationResult> {
  const originalText = String(text || "");
  const enabled = options.enabled ?? isAemetAutoTranslationEnabled();

  if (!enabled || !originalText.trim()) {
    return {
      text: originalText,
      source: "original",
      cached: false,
      valid: false,
    };
  }

  const key = buildAemetDescriptionTranslationKey(originalText, targetLang);
  const cached = memoryCache.get(key);
  if (cached) return cached;

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const fetchFn = options.fetchFn || fetch;
  const endpoint = options.endpoint || getAemetTranslationEndpoint();

  const request = (async () => {
    const appCheckToken = await (options.getAppCheckTokenFn || getAemetTranslationAppCheckToken)();
    if (!appCheckToken) {
      return {
        text: originalText,
        source: "original" as const,
        cached: false,
        valid: false,
      };
    }

    console.log("[AEMET-TRANSLATION] fetch starting");
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Firebase-AppCheck": appCheckToken,
      },
      body: JSON.stringify({ text: originalText, targetLang }),
    });

    if (!response.ok) {
      console.warn("[AEMET-TRANSLATION] fetch completed", {
        status: response.status,
        source: "original",
        valid: false,
        cached: false,
      });
      return {
        text: originalText,
        source: "original" as const,
        cached: false,
        valid: false,
      };
    }

    const data = await response.json();
    console.log("[AEMET-TRANSLATION] fetch completed", {
      status: response.status,
      source: data?.source,
      valid: data?.valid,
      cached: data?.cached,
    });
    const translatedText = typeof data?.text === "string" ? data.text : originalText;
    const valid = data?.valid === true && translatedText.trim().length > 0;

    const result: AemetDescriptionTranslationResult = valid
      ? {
          text: translatedText,
          source:
            data?.source === "cache" || data?.source === "provider"
              ? data.source
              : "provider",
          cached: data?.cached === true,
          valid: true,
        }
      : {
          text: originalText,
          source: "original",
          cached: false,
          valid: false,
        };

    memoryCache.set(key, result);
    return result;
  })()
    .catch(() => ({
      text: originalText,
      source: "original" as const,
      cached: false,
      valid: false,
    }))
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, request);
  return request;
}
