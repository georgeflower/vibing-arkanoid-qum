/**
 * Interpolate a position along the polyline prev -> path points -> cur by
 * distance fraction `alpha`. Writes into `out` (no allocations).
 * Returns false when the polyline is (near) zero length.
 */
export function interpolateAlongPath(
  prevX: number,
  prevY: number,
  path: number[] | undefined,
  curX: number,
  curY: number,
  alpha: number,
  out: { x: number; y: number },
): boolean {
  const n = path ? path.length - (path.length % 2) : 0;

  let total = 0;
  let px = prevX;
  let py = prevY;
  for (let i = 0; i < n; i += 2) {
    total += Math.hypot(path![i] - px, path![i + 1] - py);
    px = path![i];
    py = path![i + 1];
  }
  total += Math.hypot(curX - px, curY - py);
  if (total < 1e-6) return false;

  let remaining = Math.min(1, Math.max(0, alpha)) * total;
  px = prevX;
  py = prevY;
  for (let i = 0; i <= n; i += 2) {
    const nx = i < n ? path![i] : curX;
    const ny = i < n ? path![i + 1] : curY;
    const seg = Math.hypot(nx - px, ny - py);
    if (remaining <= seg || i === n) {
      const t = seg > 1e-9 ? Math.min(1, remaining / seg) : 1;
      out.x = px + (nx - px) * t;
      out.y = py + (ny - py) * t;
      return true;
    }
    remaining -= seg;
    px = nx;
    py = ny;
  }
  return true;
}
