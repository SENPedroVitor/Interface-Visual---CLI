interface ThemeRevealClipOptions {
  cx: number;
  cy: number;
  maxRadius: number;
  viewportWidth: number;
  viewportHeight: number;
}

function formatPercent(value: number): string {
  return `${Number(value.toFixed(4))}%`;
}

export function getThemeRevealClipPaths({
  cx,
  cy,
  maxRadius,
  viewportWidth,
  viewportHeight,
}: ThemeRevealClipOptions): [string, string] {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);
  const point = `${formatPercent((cx / safeWidth) * 100)} ${formatPercent((cy / safeHeight) * 100)}`;
  const referenceRadius = Math.hypot(safeWidth, safeHeight) / Math.SQRT2;
  const radius = formatPercent((maxRadius / referenceRadius) * 100);

  return [`circle(0% at ${point})`, `circle(${radius} at ${point})`];
}
