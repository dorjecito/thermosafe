import type { SkinType } from "../components/SkinTypeInfo";

export const SKIN_TYPE_STORAGE_KEY = "skinType";
export const SKIN_TYPE_CONFIGURED_STORAGE_KEY = "skinTypeConfigured";
export const SKIN_TYPE_PROMPT_DISMISSED_STORAGE_KEY = "skinTypePromptDismissed";
export const SKIN_TYPE_PROMPT_SEEN_STORAGE_KEY = "skinTypePromptSeen";

export type SkinTypeStorage = Pick<Storage, "getItem">;

export function readStoredBoolean(
  storage: SkinTypeStorage,
  key: string
): boolean | null {
  const value = storage.getItem(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function readStoredSkinType(storage: SkinTypeStorage): SkinType {
  const savedSkinType = Number(storage.getItem(SKIN_TYPE_STORAGE_KEY));
  return savedSkinType >= 1 && savedSkinType <= 6
    ? (savedSkinType as SkinType)
    : 3;
}

export function inferSkinTypeConfigured(storage: SkinTypeStorage): boolean {
  const storedConfigured = readStoredBoolean(
    storage,
    SKIN_TYPE_CONFIGURED_STORAGE_KEY
  );
  if (storedConfigured !== null) return storedConfigured;

  const savedSkinType = Number(storage.getItem(SKIN_TYPE_STORAGE_KEY));
  // Migració conservadora: un valor legacy diferent de 3 només pot venir
  // d'una tria explícita; un 3 legacy és indistingible del fallback històric.
  return savedSkinType >= 1 && savedSkinType <= 6 && savedSkinType !== 3;
}

export function shouldShowSkinTypePrompt(storage: SkinTypeStorage): boolean {
  return (
    !inferSkinTypeConfigured(storage) &&
    readStoredBoolean(storage, SKIN_TYPE_PROMPT_DISMISSED_STORAGE_KEY) !== true &&
    readStoredBoolean(storage, SKIN_TYPE_PROMPT_SEEN_STORAGE_KEY) !== true
  );
}
