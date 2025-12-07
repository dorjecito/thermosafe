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

export function useSmartActivity(): SmartActivityState {
  const [enabled, setEnabled] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<ActivityLevel>("rest");

  const lastLevelRef = useRef<ActivityLevel>("rest");

  // FILTRE SUAVITZAT (low-pass)
  const smoothDyn = useRef(0);

  // HISTÈRESI TEMPORAL (evita canvis nerviosos)
  const stableSince = useRef(Date.now());

  console.log("[ACTIVITY] Support devicemotion:", "ondevicemotion" in window);

  useEffect(() => {
    console.log("[ACTIVITY] useEffect fired. enabled =", enabled);

    if (!enabled) {
      console.log("[ACTIVITY] ❌ Detecció NO activada → no registrem listener");
      return;
    }

    console.log("[ACTIVITY] 🔄 Registrant listener devicemotion…");

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!event.accelerationIncludingGravity) return;

      const ax = event.accelerationIncludingGravity.x ?? 0;
      const ay = event.accelerationIncludingGravity.y ?? 0;
      const az = event.accelerationIncludingGravity.z ?? 0;

      const g = 9.81;
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);

      let dynRaw = Math.max(0, mag - g);

      // 🔻 Suavitza molt el senyal → adéu tremolors
      smoothDyn.current = smoothDyn.current * 0.85 + dynRaw * 0.15;
      const dyn = smoothDyn.current;

      // 🔽 CLASSIFICACIÓ REALISTA
      let newLevel: ActivityLevel = "rest";

      if (dyn > 2.0) newLevel = "intense";
      else if (dyn > 1.0) newLevel = "moderate";
      else if (dyn > 0.25) newLevel = "walk";
      else newLevel = "rest";

      // 🕒 HISTÈRESI de 1 segon per evitar canvis nerviosos
      const now = Date.now();

      if (newLevel !== lastLevelRef.current) {
        if (now - stableSince.current > 1000) {
          console.log(
            `[ACTIVITY] 🆕 Canvi confirmat: ${lastLevelRef.current} → ${newLevel}`
          );
          lastLevelRef.current = newLevel;
          setLevel(newLevel);
          stableSince.current = now;
        }
      } else {
        stableSince.current = now;
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    console.log("[ACTIVITY] ✔ Listener devicemotion ACTIVAT");

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      console.log("[ACTIVITY] ✖ Listener devicemotion DESACTIVAT");
    };
  }, [enabled]);

  const deactivate = () => {
    console.log("[ACTIVITY] 🔴 Detecció desactivada manualment");
    setEnabled(false);
  };

  const activate = async () => {
    setError(null);
    setRequesting(true);
    console.log("[ACTIVITY] 🔵 Intentant activar detecció…");

    try {
      const anyDevMotion = DeviceMotionEvent as any;

      if (typeof anyDevMotion?.requestPermission === "function") {
        console.log("[ACTIVITY] iOS → Necessita requestPermission()");
        const res = await anyDevMotion.requestPermission();
        console.log("[ACTIVITY] Resultat requestPermission:", res);

        if (res !== "granted") {
          setError("Permís de moviment denegat");
          setEnabled(false);
          setRequesting(false);
          return;
        }
      }

      console.log("[ACTIVITY] ✔ Permís concedit → ACTIVAT");
      setEnabled(true);
    } catch (e: any) {
      console.log("[ACTIVITY] ❌ ERROR activant:", e);
      setError(e?.message || "No s'ha pogut activar la detecció de moviment");
      setEnabled(false);
    } finally {
      setRequesting(false);
    }
  };

  const delta = DELTAS[level];

  return { level, delta, enabled, requesting, error, activate, deactivate };
}