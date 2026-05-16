interface LinePoints {
  points: number[];
}

/** Squared distance from point to line segment. */
function distToSegmentSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const ox = px - x1;
    const oy = py - y1;
    return ox * ox + oy * oy;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const rx = px - cx;
  const ry = py - cy;
  return rx * rx + ry * ry;
}

function minDistToLineSq(
  px: number,
  py: number,
  points: number[],
): number {
  let min = Infinity;
  for (let i = 0; i < points.length - 2; i += 2) {
    const d = distToSegmentSq(
      px,
      py,
      points[i],
      points[i + 1],
      points[i + 2],
      points[i + 3],
    );
    if (d < min) min = d;
  }
  return min;
}

/** Line ids within radius (stage coordinates) of a point. */
export function findLinesNearPoint<T extends LinePoints>(
  lines: T[],
  point: { x: number; y: number },
  radius: number,
  getId: (line: T, index: number) => string,
): string[] {
  const radiusSq = radius * radius;
  const hits: string[] = [];
  lines.forEach((line, index) => {
    if (line.points.length < 2) return;
    if (minDistToLineSq(point.x, point.y, line.points) <= radiusSq) {
      hits.push(getId(line, index));
    }
  });
  return hits;
}
