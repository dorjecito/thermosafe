export const CHUNK_RELOAD_STORAGE_KEY = "thermosafe_chunk_reload_attempted";

export const CHUNK_RELOAD_WINDOW_MS = 5 * 60 * 1000;

export type ChunkLoadRecoveryDecision =
  | "not_chunk_error"
  | "reload"
  | "already_attempted";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return [error.name, error.message, error.stack].filter(Boolean).join(" ");
  }
  return String(error ?? "");
}

export function isChunkLoadError(error: unknown): boolean {
  const text = errorText(error);

  return (
    /Failed to fetch dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text) ||
    /Loading chunk .* failed/i.test(text) ||
    /ChunkLoadError/i.test(text)
  );
}

function parseStoredTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getChunkLoadRecoveryDecision(
  error: unknown,
  storage: StorageLike | null | undefined,
  now = Date.now(),
  windowMs = CHUNK_RELOAD_WINDOW_MS
): ChunkLoadRecoveryDecision {
  if (!isChunkLoadError(error) || !storage) return "not_chunk_error";

  const previousAttempt = parseStoredTimestamp(
    storage.getItem(CHUNK_RELOAD_STORAGE_KEY)
  );

  if (previousAttempt != null && now - previousAttempt < windowMs) {
    return "already_attempted";
  }

  storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  return "reload";
}

export function clearExpiredChunkReloadAttempt(
  storage: StorageLike | null | undefined,
  now = Date.now(),
  windowMs = CHUNK_RELOAD_WINDOW_MS
): void {
  if (!storage) return;

  const previousAttempt = parseStoredTimestamp(
    storage.getItem(CHUNK_RELOAD_STORAGE_KEY)
  );

  if (previousAttempt != null && now - previousAttempt >= windowMs) {
    storage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
  }
}
