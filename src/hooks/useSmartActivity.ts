// src/hooks/useSmartActivity.ts
import { useEffect, useRef, useState } from "react";

export type ActivityLevel = "rest" | "walk" | "moderate" | "intense";

interface SmartActivityState {
  level: ActivityLevel;
  delta: number;
  enabled: boolean;
  requesting: boolean;
  error: string | null;
  activate: () => Promise<void>;
  deactivate: () => void;
}

const DELTAS: Record<ActivityLevel, number> = {
  rest: 0,
  walk: 5,
  moderate: 8,
  intense: 12,
};

const SAMPLE_INTERVAL_MS = 200; // ~5 Hz: redueix CPU sense perdre lectura de moviment humà.
const WINDOW_MS = 3000;
const CANDIDATE_CONFIRM_MS = 1000;

const logActivity = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

export function useSmartActivity(): SmartActivityState {
  const [enabled, setEnabled] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<ActivityLevel>("rest");

  const lastLevelRef = useRef<ActivityLevel>("rest");
  const candidateLevelRef = useRef<ActivityLevel>("rest");
  const candidateSinceRef = useRef(Date.now());
  const lastProcessedAt = useRef(0);
  const windowStartedAt = useRef(Date.now());
  const windowDynSum = useRef(0);
  const windowSamples = useRef(0);

  // FILTRE SUAVITZAT (low-pass)
  const smoothDyn = useRef(0);

  useEffect(() => {
    logActivity("[ACTIVITY] Support devicemotion:", "ondevicemotion" in window);
  }, []);

  useEffect(() => {
    logActivity("[ACTIVITY] useEffect fired. enabled =", enabled);

    if (!enabled) {
      logActivity("[ACTIVITY] ❌ Detecció NO activada → no registrem listener");
      return;
    }

    logActivity("[ACTIVITY] 🔄 Registrant listener devicemotion…");

    const classifyDyn = (dyn: number): ActivityLevel => {
      if (dyn > 2.0) return "intense";
      if (dyn > 1.0) return "moderate";
      if (dyn > 0.25) return "walk";
      return "rest";
    };

    const resetWindow = (now: number) => {
      windowStartedAt.current = now;
      windowDynSum.current = 0;
      windowSamples.current = 0;
    };

    const applyCandidate = (newLevel: ActivityLevel, now: number) => {
      if (newLevel === lastLevelRef.current) {
        candidateLevelRef.current = newLevel;
        candidateSinceRef.current = now;
        return;
      }

      if (newLevel !== candidateLevelRef.current) {
        candidateLevelRef.current = newLevel;
        candidateSinceRef.current = now;
        return;
      }

      if (now - candidateSinceRef.current >= CANDIDATE_CONFIRM_MS) {
        logActivity(
          `[ACTIVITY] 🆕 Canvi confirmat: ${lastLevelRef.current} → ${newLevel}`
        );
        lastLevelRef.current = newLevel;
        setLevel(newLevel);
        candidateSinceRef.current = now;
      }
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      if (document.hidden) return;
      if (!event.accelerationIncludingGravity) return;

      const now = Date.now();
      if (now - lastProcessedAt.current < SAMPLE_INTERVAL_MS) return;
      lastProcessedAt.current = now;

      const ax = event.accelerationIncludingGravity.x ?? 0;
      const ay = event.accelerationIncludingGravity.y ?? 0;
      const az = event.accelerationIncludingGravity.z ?? 0;

      const g = 9.81;
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);

      let dynRaw = Math.max(0, mag - g);

      // 🔻 Suavitza molt el senyal → adéu tremolors
      smoothDyn.current = smoothDyn.current * 0.85 + dynRaw * 0.15;
      const dyn = smoothDyn.current;

      windowDynSum.current += dyn;
      windowSamples.current += 1;

      if (now - windowStartedAt.current < WINDOW_MS) return;

      // Classifiquem per finestra per evitar que pics aïllats canviïn l'estat.
      const avgDyn =
        windowSamples.current > 0 ? windowDynSum.current / windowSamples.current : 0;
      const newLevel = classifyDyn(avgDyn);

      resetWindow(now);
      applyCandidate(newLevel, now);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      const now = Date.now();
      resetWindow(now);
      lastProcessedAt.current = now;
    };

    window.addEventListener("devicemotion", handleMotion);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    logActivity("[ACTIVITY] ✔ Listener devicemotion ACTIVAT");

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      logActivity("[ACTIVITY] ✖ Listener devicemotion DESACTIVAT");
    };
  }, [enabled]);

  const resetActivityState = () => {
    const now = Date.now();
    lastLevelRef.current = "rest";
    candidateLevelRef.current = "rest";
    candidateSinceRef.current = now;
    lastProcessedAt.current = 0;
    windowStartedAt.current = now;
    windowDynSum.current = 0;
    windowSamples.current = 0;
    smoothDyn.current = 0;
    setLevel("rest");
  };

  const deactivate = () => {
    logActivity("[ACTIVITY] 🔴 Detecció desactivada manualment");
    resetActivityState();
    setEnabled(false);
  };

  const activate = async () => {
    setError(null);
    setRequesting(true);
    resetActivityState();
    logActivity("[ACTIVITY] 🔵 Intentant activar detecció…");

    try {
      const anyDevMotion = DeviceMotionEvent as any;

      if (typeof anyDevMotion?.requestPermission === "function") {
        logActivity("[ACTIVITY] iOS → Necessita requestPermission()");
        const res = await anyDevMotion.requestPermission();
        logActivity("[ACTIVITY] Resultat requestPermission:", res);

        if (res !== "granted") {
          setError("Permís de moviment denegat");
          setEnabled(false);
          setRequesting(false);
          return;
        }
      }

      logActivity("[ACTIVITY] ✔ Permís concedit → ACTIVAT");
      setEnabled(true);
    } catch (e: any) {
      logActivity("[ACTIVITY] ❌ ERROR activant:", e);
      setError(e?.message || "No s'ha pogut activar la detecció de moviment");
      setEnabled(false);
    } finally {
      setRequesting(false);
    }
  };

  const delta = DELTAS[level];

  return { level, delta, enabled, requesting, error, activate, deactivate };
}
