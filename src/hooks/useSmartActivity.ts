// src/hooks/useSmartActivity.ts
import { useEffect, useRef, useState } from "react";

export type ActivityLevel = "rest" | "walk" | "moderate" | "intense";

interface SmartActivityState {
  level: ActivityLevel;
  delta: number;           // ajust en °C
  enabled: boolean;        // tenim permisos + activat
  requesting: boolean;     // estam demanant permís
  error: string | null;
  activate: () => Promise<void>; // cridat per un botó
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

  useEffect(() => {
    if (!enabled) return;

    // Buffer per suavitzar mesures (mitjana mòbil)
const buffer = useRef<number[]>([]);

const handleMotion = (event: DeviceMotionEvent) => {
  if (!event.accelerationIncludingGravity) return;

  const ax = event.accelerationIncludingGravity.x ?? 0;
  const ay = event.accelerationIncludingGravity.y ?? 0;
  const az = event.accelerationIncludingGravity.z ?? 0;

  const g = 9.81;
  const mag = Math.sqrt(ax * ax + ay * ay + az * az);
  const dyn = Math.max(0, Math.abs(mag - g)); // moviment real

  // 👉 Guarda els últims valors (10 mostres = 100ms aprox.)
  buffer.current.push(dyn);
  if (buffer.current.length > 10) buffer.current.shift();

  // 👉 Mitjana
  const avg = buffer.current.reduce((a, b) => a + b, 0) / buffer.current.length;

  let newLevel: ActivityLevel = "rest";

  // 👉 Llindars basats en dades reals
  if (avg > 0.50) newLevel = "intense";
  else if (avg > 0.20) newLevel = "moderate";
  else if (avg > 0.05) newLevel = "walk";

  // 👉 Evita canvis nerviosos: només canvia si es manté 300 ms
  if (newLevel !== lastLevelRef.current) {
    clearTimeout((lastLevelRef as any)._timer);

    (lastLevelRef as any)._timer = setTimeout(() => {
      lastLevelRef.current = newLevel;
      setLevel(newLevel);
      console.log("[DEBUG] Nivell canviat →", newLevel, "(avg:", avg.toFixed(3) + ")");
    }, 300);
  }
};

    window.addEventListener("devicemotion", handleMotion);
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [enabled]);

  const activate = async () => {
    setError(null);
    setRequesting(true);

    try {
      // iOS necessita requestPermission
      const anyDevMotion = (DeviceMotionEvent as any);
      if (typeof anyDevMotion?.requestPermission === "function") {
        const res = await anyDevMotion.requestPermission();
        if (res !== "granted") {
          setError("Permís de moviment denegat");
          setEnabled(false);
          setRequesting(false);
          return;
        }
      }
      // Si arribam aquí → permís OK o no necessari
      setEnabled(true);
    } catch (e: any) {
      setError(e?.message || "No s'ha pogut activar la detecció de moviment");
      setEnabled(false);
    } finally {
      setRequesting(false);
    }
  };

  const delta = DELTAS[level];

  return { level, delta, enabled, requesting, error, activate };
}