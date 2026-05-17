import "server-only";

import sharp from "sharp";
import {
  canvasToExport,
  computeMapProjection,
  SCENERY_EXPORT_HEIGHT,
  SCENERY_EXPORT_WIDTH,
} from "@/lib/scenery-coords";
import type { SceneryGeospatialContext } from "@/lib/scenery-prompt";

const DEFAULT_LANDMARK_RADIUS = 96;

export interface LandmarkCompositeInput {
  pinIndex: number;
  imageBuffer: Buffer;
}

/** Composite generated landmark tiles onto the base map at pin coordinates. */
export async function compositeLandmarksOntoBase(
  baseImage: Buffer,
  geospatial: SceneryGeospatialContext,
  landmarks: LandmarkCompositeInput[],
  options?: { radius?: number },
): Promise<Buffer> {
  const radius = options?.radius ?? DEFAULT_LANDMARK_RADIUS;
  const diameter = radius * 2;
  const projection = computeMapProjection(geospatial);

  const base = sharp(baseImage).resize(
    SCENERY_EXPORT_WIDTH,
    SCENERY_EXPORT_HEIGHT,
    { fit: "fill" },
  );

  const composites: sharp.OverlayOptions[] = [];

  for (const item of landmarks) {
    const pin = geospatial.pins[item.pinIndex];
    if (!pin) continue;

    const { x, y } = canvasToExport(pin.canvas_x, pin.canvas_y, projection);
    const left = Math.round(Math.max(0, Math.min(SCENERY_EXPORT_WIDTH - diameter, x - radius)));
    const top = Math.round(Math.max(0, Math.min(SCENERY_EXPORT_HEIGHT - diameter, y - radius)));

    const tile = await sharp(item.imageBuffer)
      .resize(diameter, diameter, { fit: "cover" })
      .png()
      .toBuffer();

    composites.push({
      input: tile,
      left,
      top,
      blend: "over",
    });
  }

  if (composites.length === 0) {
    return base.jpeg({ quality: 90 }).toBuffer();
  }

  return base.composite(composites).jpeg({ quality: 90 }).toBuffer();
}

export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
