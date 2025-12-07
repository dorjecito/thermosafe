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

  /* ----------------------------------------------------------
   * 🔍 DEBUG: MOSTRAR SI EL NAVEGADOR SUPORTA devicemotion
   * ---------------------------------------------------------- */
  console.log("[ACTIVITY] Support devicemotion:", "ondevicemotion" in window);

  useEffect(() => {
    console.log("[ACTIVITY] useEffect fired. enabled =", enabled);

    if (!enabled) {
      console.log("[ACTIVITY] ❌ Detecció NO activada → no registrem listener");
      return;
    }

    console.log("[ACTIVITY] 🔄 Registrant listener devicemotion…");

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!event.accelerationIncludingGravity) {
        console.log("[ACTIVITY] ⚠ Sense accelerationIncludingGravity");
        return;
      }

      const ax = event.accelerationIncludingGravity.x ?? 0;
      const ay = event.accelerationIncludingGravity.y ?? 0;
      const az = event.accelerationIncludingGravity.z ?? 0;

      const g = 9.81;
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);

      const dyn = Math.max(0, mag - g);

      console.log(
        `[ACTIVITY] event rebut → ax=${ax.toFixed(2)}, ay=${ay.toFixed(
          2
        )}, az=${az.toFixed(2)}, dyn=${dyn.toFixed(2)}`
      );

      let newLevel: ActivityLevel = "rest";

      if (dyn > 4) newLevel = "intense";
      else if (dyn > 2.5) newLevel = "moderate";
      else if (dyn > 0.8) newLevel = "walk";
      else newLevel = "rest";

      if (newLevel !== lastLevelRef.current) {
        console.log(
          `[ACTIVITY] 🆕 Canvi d'activitat: ${lastLevelRef.current} → ${newLevel}`
        );
        lastLevelRef.current = newLevel;
        setLevel(newLevel);
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    console.log("[ACTIVITY] ✔ Listener devicemotion ACTIVAT");

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      console.log("[ACTIVITY] ✖ Listener devicemotion DESACTIVAT");
    };
  }, [enabled]);

  /* --------------------------------------------------------
   * 🔘 Activació manual per botó
   * -------------------------------------------------------- */
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
      } else {
        console.log("[ACTIVITY] No és iOS o no requereix permís explícit.");
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

  return { level, delta, enabled, requesting, error, activate };
}