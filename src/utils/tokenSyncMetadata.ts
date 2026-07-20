export const TOKEN_LAST_SYNCED_LOCAL_KEY = "thermosafe_token_last_synced_at";

export function buildTokenLastSyncedPayload<T>(timestampValue: T): {
  tokenLastSyncedAt: T;
} {
  return { tokenLastSyncedAt: timestampValue };
}

export function saveTokenLastSyncedLocally(
  storage: Pick<Storage, "setItem">,
  now: Date = new Date()
): void {
  storage.setItem(TOKEN_LAST_SYNCED_LOCAL_KEY, now.toISOString());
}

export function omitTokenLastSyncedAt<T extends Record<string, unknown>>(
  payload: T
): Omit<T, "tokenLastSyncedAt"> {
  const { tokenLastSyncedAt: _tokenLastSyncedAt, ...rest } = payload;
  void _tokenLastSyncedAt;
  return rest;
}

export function isFirestorePermissionDenied(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error ?? "");

  return (
    code === "permission-denied" ||
    /missing or insufficient permissions/i.test(message)
  );
}

export async function writeWithOptionalTokenSyncFallback<
  T extends Record<string, unknown>
>(
  payload: T,
  write: (payloadToWrite: T | Omit<T, "tokenLastSyncedAt">) => Promise<void>,
  onTokenSyncWritten: () => void,
  onTokenSyncSkipped?: (error: unknown) => void
): Promise<{ tokenSyncWritten: boolean }> {
  try {
    await write(payload);
    onTokenSyncWritten();
    return { tokenSyncWritten: true };
  } catch (error) {
    if (!("tokenLastSyncedAt" in payload) || !isFirestorePermissionDenied(error)) {
      throw error;
    }

    await write(omitTokenLastSyncedAt(payload));
    onTokenSyncSkipped?.(error);
    return { tokenSyncWritten: false };
  }
}
