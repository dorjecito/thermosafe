/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_THERMOSAFE_BUILD_ID?: string;
  readonly VITE_AEMET_AUTO_TRANSLATION_ENABLED?: string;
  readonly VITE_AEMET_TRANSLATION_ENDPOINT?: string;
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string;
}
