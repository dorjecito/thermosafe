export type UvSolarNowLabelPosition = {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
};

export function getUvSolarNowLabelPosition(
  progress: number,
  sunX: number,
  sunY: number
): UvSolarNowLabelPosition {
  if (progress < 0.35) {
    return { x: sunX + 14, y: sunY - 10, textAnchor: "start" };
  }

  if (progress <= 0.65) {
    return { x: sunX, y: sunY + 28, textAnchor: "middle" };
  }

  return { x: sunX - 14, y: sunY - 10, textAnchor: "end" };
}
