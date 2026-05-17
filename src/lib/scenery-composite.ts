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

async function softDiscAlphaMask(diameter: number): Promise<Buffer> {
  const r = diameter / 2;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}">
  <defs>
    <radialGradient id="edge" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="78%" stop-color="white" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="${r}" cy="${r}" r="${r}" fill="url(#edge)"/>
</svg>`;
  return sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer();
}

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
  const discMask = await softDiscAlphaMask(diameter);

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

    const cover = await sharp(item.imageBuffer)
      .resize(diameter, diameter, { fit: "cover" })
      .ensureAlpha();

    const tile = await cover
      .composite([{ input: discMask, blend: "dest-in" }])
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
