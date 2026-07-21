export type PublishedVersion = {
  version?: string;
  buildId?: string;
};

export const VERSION_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function buildVersionUrl(now = Date.now()): string {
  return `/version.json?t=${encodeURIComponent(String(now))}`;
}

export function isNewVersionAvailable(
  currentBuildId: string,
  published: PublishedVersion | null
): boolean {
  return Boolean(
    currentBuildId &&
      published?.buildId &&
      published.buildId !== currentBuildId
  );
}

export async function fetchPublishedVersion(
  fetcher: typeof fetch = fetch,
  now = Date.now
): Promise<PublishedVersion | null> {
  const response = await fetcher(buildVersionUrl(now()), {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as PublishedVersion;
  if (!data || typeof data !== "object") return null;

  return {
    version: typeof data.version === "string" ? data.version : undefined,
    buildId: typeof data.buildId === "string" ? data.buildId : undefined,
  };
}
