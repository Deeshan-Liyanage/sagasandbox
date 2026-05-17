import type { SceneryGeospatialContext, SceneryStrokeBounds } from "@/lib/scenery-prompt";

export const SCENERY_EXPORT_WIDTH = 1280;
export const SCENERY_EXPORT_HEIGHT = 720;
const BOUNDS_PADDING = 48;

export interface MapProjection {
  exportWidth: number;
  exportHeight: number;
  minX: number;
  minY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
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

export function computeContentBounds(
  geospatial: SceneryGeospatialContext,
): SceneryStrokeBounds {
  let bounds = geospatial.stroke_bounds;
  for (const pin of geospatial.pins) {
    bounds = extendBounds(bounds, pin.canvas_x, pin.canvas_y, 24);
  }
  if (!bounds) {
    return {
      minX: 0,
      minY: 0,
      maxX: geospatial.canvas_width || SCENERY_EXPORT_WIDTH,
      maxY: geospatial.canvas_height || SCENERY_EXPORT_HEIGHT,
    };
  }
  return bounds;
}

/** Map canvas coordinates to scenery export image space (1280×720). */
export function computeMapProjection(
  geospatial: SceneryGeospatialContext,
  exportWidth = SCENERY_EXPORT_WIDTH,
  exportHeight = SCENERY_EXPORT_HEIGHT,
): MapProjection {
  const { minX, minY, maxX, maxY } = computeContentBounds(geospatial);
  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);
  const innerW = exportWidth - BOUNDS_PADDING * 2;
  const innerH = exportHeight - BOUNDS_PADDING * 2;
  const scale = Math.min(innerW / contentW, innerH / contentH);
  const offsetX = BOUNDS_PADDING - minX * scale;
  const offsetY = BOUNDS_PADDING - minY * scale;

  return {
    exportWidth,
    exportHeight,
    minX,
    minY,
    scale,
    offsetX,
    offsetY,
  };
}

export function canvasToExport(
  canvasX: number,
  canvasY: number,
  projection: MapProjection,
): { x: number; y: number } {
  return {
    x: canvasX * projection.scale + projection.offsetX,
    y: canvasY * projection.scale + projection.offsetY,
  };
}
