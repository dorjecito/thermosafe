export function shouldShowUvBlock(
  isDay: boolean,
  currentUv: number | null | undefined
): boolean {
  return isDay && typeof currentUv === "number" && Number.isFinite(currentUv);
}
