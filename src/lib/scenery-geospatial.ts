import type { SceneryGeospatialContext, SceneryStrokeBounds } from "@/lib/scenery-prompt";

export interface GeospatialLine {
  points: number[];
}

export interface GeospatialPin {
  canvas_x: number;
  canvas_y: number;
  label: string;
  description?: string | null;
}

function extendBounds(
  bounds: SceneryStrokeBounds | null,
  x: number,
  y: number,
  radius = 0,
): SceneryStrokeBounds {
  if (!bounds) {
    return { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius };
  }
  return {
    minX: Math.min(bounds.minX, x - radius),
    minY: Math.min(bounds.minY, y - radius),
    maxX: Math.max(bounds.maxX, x + radius),
    maxY: Math.max(bounds.maxY, y + radius),
  };
}

export function computeStrokeBounds(
  lines: GeospatialLine[],
  pins: GeospatialPin[] = [],
): SceneryStrokeBounds | null {
  let bounds: SceneryStrokeBounds | null = null;

  for (const line of lines) {
    for (let i = 0; i < line.points.length; i += 2) {
      const x = line.points[i];
      const y = line.points[i + 1];
      if (typeof x !== "number" || typeof y !== "number") continue;
      bounds = extendBounds(bounds, x, y, 8);
    }
  }

  for (const pin of pins) {
    bounds = extendBounds(bounds, pin.canvas_x, pin.canvas_y, 24);
  }

  return bounds;
}

export function buildGeospatialContext(
  lines: GeospatialLine[],
  pins: GeospatialPin[],
  canvas_width: number,
  canvas_height: number,
): SceneryGeospatialContext {
  const stroke_point_count = lines.reduce(
    (sum, line) => sum + Math.floor(line.points.length / 2),
    0,
  );

  return {
    canvas_width,
    canvas_height,
    stroke_count: lines.length,
    stroke_point_count,
    stroke_bounds: computeStrokeBounds(lines, pins),
    pins: pins.map((p) => ({
      label: p.label,
      description: p.description ?? null,
      canvas_x: p.canvas_x,
      canvas_y: p.canvas_y,
    })),
  };
}
