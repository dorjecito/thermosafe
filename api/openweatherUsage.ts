export type OpenWeatherUsageField =
  | "oneCall"
  | "currentWeather"
  | "geoDirect"
  | "geoReverse";

type TrackDeps = {
  dbInstance?: {
    collection: (name: string) => {
      doc: (id: string) => {
        set: (data: Record<string, unknown>, options: { merge: boolean }) => Promise<unknown>;
      };
    };
  };
  fieldValue?: {
    increment: (value: number) => unknown;
    serverTimestamp: () => unknown;
  };
  logger?: Pick<Console, "warn">;
};

let cachedDb: unknown = null;
let cachedFieldValue: {
  increment: (value: number) => unknown;
  serverTimestamp: () => unknown;
} | null = null;

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n");
}

function getServiceAccountFromEnv() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }
    return parsed;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials for OpenWeather usage tracking"
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

async function getDb() {
  if (!cachedDb) {
    const [{ cert, getApps, initializeApp }, { FieldValue, getFirestore }] =
      await Promise.all([
        import("firebase-admin/app"),
        import("firebase-admin/firestore"),
      ]);
    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential: cert(getServiceAccountFromEnv()),
          });
    cachedDb = getFirestore(app);
    cachedFieldValue = FieldValue;
  }

  return cachedDb;
}

export function getUsageDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function getOpenWeatherUsageFieldForRoute(
  route: string
): OpenWeatherUsageField | null {
  if (route === "onecall") return "oneCall";
  if (route === "weather") return "currentWeather";
  if (route === "geo-direct") return "geoDirect";
  if (route === "geo-reverse") return "geoReverse";
  return null;
}

export function buildOpenWeatherUsagePayload(
  field: OpenWeatherUsageField,
  hasError: boolean,
  fieldValue: {
    increment: (value: number) => unknown;
    serverTimestamp: () => unknown;
  },
  now = new Date()
) {
  const date = getUsageDateKey(now);

  return {
    id: `openweather_${date}`,
    data: {
      provider: "openweather",
      date,
      oneCall: fieldValue.increment(field === "oneCall" ? 1 : 0),
      currentWeather: fieldValue.increment(field === "currentWeather" ? 1 : 0),
      geoDirect: fieldValue.increment(field === "geoDirect" ? 1 : 0),
      geoReverse: fieldValue.increment(field === "geoReverse" ? 1 : 0),
      errors: fieldValue.increment(hasError ? 1 : 0),
      lastCallAt: fieldValue.serverTimestamp(),
    },
  };
}

export async function trackOpenWeatherApiUsage(
  field: OpenWeatherUsageField,
  hasError: boolean,
  deps: TrackDeps = {}
) {
  const logger = deps.logger || console;

  try {
    const db = deps.dbInstance || ((await getDb()) as NonNullable<TrackDeps["dbInstance"]>);
    const fieldValue = deps.fieldValue || cachedFieldValue;
    if (!fieldValue) {
      throw new Error("Firebase Admin FieldValue is not initialized");
    }
    const { id, data } = buildOpenWeatherUsagePayload(field, hasError, fieldValue);
    await db.collection("apiUsage").doc(id).set(data, { merge: true });
  } catch (error) {
    logger.warn("[apiUsage] No s'ha pogut registrar consum OpenWeather:", error);
  }
}
