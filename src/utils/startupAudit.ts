type StartupDetail = Record<string, unknown>;

type StartupStep = {
  name: string;
  durationMs: number;
  detail?: StartupDetail;
};

const START_PREFIX = "thermosafe:";
const starts = new Map<string, { at: number; detail?: StartupDetail }>();
const steps: StartupStep[] = [];
const marked = new Set<string>();

function isDevAuditEnabled() {
  return Boolean(import.meta.env?.DEV && typeof performance !== "undefined");
}

function markName(name: string) {
  return `${START_PREFIX}${name}`;
}

function duration(from: string, to = performance.now()) {
  const start = starts.get(from)?.at;
  return typeof start === "number" ? Math.max(0, to - start) : null;
}

function roundMs(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

export function startupMark(name: string, detail?: StartupDetail) {
  if (!isDevAuditEnabled()) return;
  if (marked.has(name)) return;

  marked.add(name);
  performance.mark(markName(name));

  if (detail) {
    console.log(`[Startup Audit] ${name}`, detail);
  }
}

export function startupStart(name: string, detail?: StartupDetail) {
  if (!isDevAuditEnabled()) return;

  starts.set(name, {
    at: performance.now(),
    detail,
  });
  performance.mark(markName(`${name}-start`));
}

export function startupEnd(name: string, detail?: StartupDetail) {
  if (!isDevAuditEnabled()) return;

  const end = performance.now();
  const start = starts.get(name);
  const durationMs = duration(name, end);
  performance.mark(markName(`${name}-end`));

  if (durationMs !== null) {
    performance.measure(
      markName(name),
      markName(`${name}-start`),
      markName(`${name}-end`)
    );
    steps.push({
      name,
      durationMs,
      detail: {
        ...(start?.detail || {}),
        ...(detail || {}),
      },
    });
  }
}

export async function startupMeasure<T>(
  name: string,
  action: () => Promise<T>,
  detail?: StartupDetail
): Promise<T> {
  startupStart(name, detail);
  try {
    const result = await action();
    startupEnd(name, { status: "ok" });
    return result;
  } catch (error) {
    startupEnd(name, { status: "error" });
    throw error;
  }
}

export function getStartupAuditSnapshot() {
  if (!isDevAuditEnabled()) return null;

  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const paintEntries = performance.getEntriesByType("paint");
  const firstPaint = paintEntries.find((entry) => entry.name === "first-paint");
  const firstContentfulPaint = paintEntries.find(
    (entry) => entry.name === "first-contentful-paint"
  );
  const sortedSteps = [...steps].sort((a, b) => b.durationMs - a.durationMs);
  const totalColdStart = performance.now();
  const firstUseful = performance.getEntriesByName(markName("first-useful-content"))[0];
  const fullData = performance.getEntriesByName(markName("full-data"))[0];

  return {
    navigation: navigation
      ? {
          domContentLoaded: roundMs(navigation.domContentLoadedEventEnd),
          load: roundMs(navigation.loadEventEnd),
          transferSize: navigation.transferSize,
          encodedBodySize: navigation.encodedBodySize,
          decodedBodySize: navigation.decodedBodySize,
        }
      : null,
    paint: {
      firstPaint: roundMs(firstPaint?.startTime),
      firstContentfulPaint: roundMs(firstContentfulPaint?.startTime),
    },
    milestones: {
      appStart: roundMs(performance.getEntriesByName(markName("app-start"))[0]?.startTime),
      reactRenderStart: roundMs(
        performance.getEntriesByName(markName("react-render-start"))[0]?.startTime
      ),
      reactMounted: roundMs(
        performance.getEntriesByName(markName("react-mounted"))[0]?.startTime
      ),
      firstRender: roundMs(
        performance.getEntriesByName(markName("first-render"))[0]?.startTime
      ),
      firstUsefulContent: roundMs(firstUseful?.startTime),
      fullData: roundMs(fullData?.startTime),
    },
    durations: steps.map((step) => ({
      name: step.name,
      durationMs: roundMs(step.durationMs),
      detail: step.detail,
    })),
    slowestStep: sortedSteps[0]
      ? {
          name: sortedSteps[0].name,
          durationMs: roundMs(sortedSteps[0].durationMs),
          detail: sortedSteps[0].detail,
        }
      : null,
    secondSlowestStep: sortedSteps[1]
      ? {
          name: sortedSteps[1].name,
          durationMs: roundMs(sortedSteps[1].durationMs),
          detail: sortedSteps[1].detail,
        }
      : null,
    totalColdStart: roundMs(totalColdStart),
  };
}

export function logStartupSummary(reason: string) {
  if (!isDevAuditEnabled()) return;

  const snapshot = getStartupAuditSnapshot();
  if (!snapshot) return;

  console.log("[Startup Audit]", {
    reason,
    ...snapshot,
  });
}
