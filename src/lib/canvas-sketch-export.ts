import Konva from "konva";

export interface SketchLine {
  points: number[];
}

export interface SketchPin {
  canvas_x: number;
  canvas_y: number;
  label: string;
}

const SKETCH_BG = "#2d2d30";
const STROKE_COLOR = "#c4b5fd";
const STROKE_WIDTH = 4;
const BOUNDS_PADDING = 48;
const MIN_EXPORT_SIZE = 512;

function extendBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  x: number,
  y: number,
  radius = 0,
) {
  return {
    minX: Math.min(minX, x - radius),
    minY: Math.min(minY, y - radius),
    maxX: Math.max(maxX, x + radius),
    maxY: Math.max(maxY, y + radius),
  };
}

function computeSketchBounds(lines: SketchLine[], pins: SketchPin[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const line of lines) {
    for (let i = 0; i < line.points.length; i += 2) {
      const x = line.points[i];
      const y = line.points[i + 1];
      if (typeof x !== "number" || typeof y !== "number") continue;
      ({ minX, minY, maxX, maxY } = extendBounds(minX, minY, maxX, maxY, x, y, 8));
    }
  }

  for (const pin of pins) {
    ({ minX, minY, maxX, maxY } = extendBounds(
      minX,
      minY,
      maxX,
      maxY,
      pin.canvas_x,
      pin.canvas_y,
      24,
    ));
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: MIN_EXPORT_SIZE, maxY: MIN_EXPORT_SIZE };
  }

  return { minX, minY, maxX, maxY };
}

/** Rasterize brush strokes (+ optional pin markers) for Fal img2img reference. */
export function exportMapSketchToDataUrl(
  lines: SketchLine[],
  pins: SketchPin[] = [],
): string | null {
  if (lines.length === 0) return null;
  if (typeof document === "undefined") return null;

  const { minX, minY, maxX, maxY } = computeSketchBounds(lines, pins);
  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);
  const width = Math.max(
    MIN_EXPORT_SIZE,
    Math.ceil(contentW + BOUNDS_PADDING * 2),
  );
  const height = Math.max(
    MIN_EXPORT_SIZE,
    Math.ceil(contentH + BOUNDS_PADDING * 2),
  );

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  document.body.appendChild(container);

  const stage = new Konva.Stage({ container, width, height });
  const layer = new Konva.Layer();
  stage.add(layer);

  layer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: SKETCH_BG,
    }),
  );

  const offsetX = BOUNDS_PADDING - minX;
  const offsetY = BOUNDS_PADDING - minY;

  for (const line of lines) {
    const shifted: number[] = [];
    for (let i = 0; i < line.points.length; i += 2) {
      shifted.push(line.points[i] + offsetX, line.points[i + 1] + offsetY);
    }
    layer.add(
      new Konva.Line({
        points: shifted,
        stroke: STROKE_COLOR,
        strokeWidth: STROKE_WIDTH,
        tension: 0.4,
        lineCap: "round",
        lineJoin: "round",
      }),
    );
  }

  for (const pin of pins) {
    const x = pin.canvas_x + offsetX;
    const y = pin.canvas_y + offsetY;
    layer.add(
      new Konva.Circle({
        x,
        y,
        radius: 8,
        fill: "#f59e0b",
        stroke: "#0e0e0f",
        strokeWidth: 2,
      }),
    );
    if (pin.label) {
      layer.add(
        new Konva.Text({
          x: x - 40,
          y: y + 10,
          width: 80,
          align: "center",
          text: pin.label,
          fontSize: 11,
          fill: "#e5e7eb",
        }),
      );
    }
  }

  layer.draw();
  const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
  stage.destroy();
  container.remove();

  return dataUrl;
}
