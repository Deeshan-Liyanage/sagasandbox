import "server-only";

import sharp from "sharp";
import {
  canvasToExport,
  computeMapProjection,
  SCENERY_EXPORT_HEIGHT,
  SCENERY_EXPORT_WIDTH,
} from "@/lib/scenery-coords";
import type { SceneryGeospatialContext } from "@/lib/scenery-prompt";
import type { SceneryLayoutPlan } from "@/lib/scenery-layout-plan";

const BG = "#1a1a1e";
const SLOT_STROKE = "#f59e0b";
const SLOT_FILL = "#78350f";
const PATH_STROKE = "#60a5fa";

function regionEllipse(
  index: number,
  regionCount: number,
  width: number,
  height: number,
  color: string,
): string {
  const cols = Math.ceil(Math.sqrt(regionCount));
  const row = Math.floor(index / cols);
  const col = index % cols;
  const cellW = width / cols;
  const cellH = height / Math.ceil(regionCount / cols);
  const cx = cellW * col + cellW / 2;
  const cy = cellH * row + cellH / 2;
  const rx = cellW * 0.38;
  const ry = cellH * 0.38;
  return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="3"/>`;
}

/** Programmatic structure map: colored regions, numbered pin slots, paths — no handwriting. */
export function buildWireframeSvg(
  plan: SceneryLayoutPlan,
  geospatial: SceneryGeospatialContext,
): string {
  const projection = computeMapProjection(geospatial);
  const { exportWidth: w, exportHeight: h } = projection;

  const regionShapes = plan.regions
    .map((region, i) =>
      regionEllipse(i, plan.regions.length, w, h, region.colorHint || "#3b82f6"),
    )
    .join("\n");

  const pathShapes = plan.paths
    .map((path, i) => {
      const y = h * (0.25 + (0.5 * (i + 1)) / (plan.paths.length + 1));
      return `<line x1="${w * 0.12}" y1="${y}" x2="${w * 0.88}" y2="${y}" stroke="${PATH_STROKE}" stroke-width="4" stroke-dasharray="12 8" opacity="0.7"/>`;
    })
    .join("\n");

  const pinSlots = geospatial.pins
    .map((pin, index) => {
      const { x, y } = canvasToExport(pin.canvas_x, pin.canvas_y, projection);
      const num = index + 1;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="22" fill="${SLOT_FILL}" stroke="${SLOT_STROKE}" stroke-width="4"/>
<text x="${x.toFixed(1)}" y="${(y + 7).toFixed(1)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#fef3c7">${num}</text>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${regionShapes}
  ${pathShapes}
  ${pinSlots}
</svg>`;
}

export async function renderWireframePng(
  plan: SceneryLayoutPlan,
  geospatial: SceneryGeospatialContext,
): Promise<Buffer> {
  const svg = buildWireframeSvg(plan, geospatial);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderWireframeDataUrl(
  plan: SceneryLayoutPlan,
  geospatial: SceneryGeospatialContext,
): Promise<string> {
  const png = await renderWireframePng(plan, geospatial);
  return `data:image/png;base64,${png.toString("base64")}`;
}

export { SCENERY_EXPORT_WIDTH, SCENERY_EXPORT_HEIGHT };
