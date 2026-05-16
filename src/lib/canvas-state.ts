export interface ParsedCanvasLine {
  id: string;
  points: number[];
}

export interface ParsedCanvasViewport {
  x: number;
  y: number;
  scale: number;
}

export interface ParsedCanvasState {
  lines: ParsedCanvasLine[];
  viewport: ParsedCanvasViewport;
}

export const MIN_SCENERY_SIZE = 64;

export interface SceneryTransform {
  x: number;
  y: number;
  /** Display width in stage coordinates (scale is always baked in). */
  width: number;
  /** Display height in stage coordinates (scale is always baked in). */
  height: number;
  scaleX: number;
  scaleY: number;
}

/** Normalize persisted transform so Konva never double-applies scale. */
export function normalizeSceneryTransform(
  transform: SceneryTransform,
): SceneryTransform {
  const scaleX = transform.scaleX > 0 ? transform.scaleX : 1;
  const scaleY = transform.scaleY > 0 ? transform.scaleY : 1;
  const width = Math.max(MIN_SCENERY_SIZE, transform.width * scaleX);
  const height = Math.max(MIN_SCENERY_SIZE, transform.height * scaleY);
  return {
    x: transform.x,
    y: transform.y,
    width,
    height,
    scaleX: 1,
    scaleY: 1,
  };
}

export interface CanvasMeta {
  scenery_preview_url?: string | null;
  depth_preview_url?: string | null;
  scenery_fal_request_id?: string | null;
  scenery_fal_model?: string | null;
  last_synthesis_at?: string | null;
  scenery_transform?: SceneryTransform | null;
}

const META_KEYS: (keyof CanvasMeta)[] = [
  "scenery_preview_url",
  "depth_preview_url",
  "scenery_fal_request_id",
  "scenery_fal_model",
  "last_synthesis_at",
  "scenery_transform",
];

type KonvaNode = {
  className?: string;
  attrs?: Record<string, unknown>;
  children?: KonvaNode[];
};

function isKonvaStage(value: unknown): value is KonvaNode {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as KonvaNode).className === "Stage"
  );
}

function isSceneryTransform(value: unknown): value is SceneryTransform {
  if (!value || typeof value !== "object") return false;
  const t = value as SceneryTransform;
  return (
    typeof t.x === "number" &&
    typeof t.y === "number" &&
    typeof t.width === "number" &&
    typeof t.height === "number" &&
    typeof t.scaleX === "number" &&
    typeof t.scaleY === "number"
  );
}

function pickMeta(source: Record<string, unknown>): CanvasMeta {
  const meta: CanvasMeta = {};
  for (const key of META_KEYS) {
    if (key in source) {
      const value = source[key];
      if (key === "scenery_transform") {
        meta.scenery_transform = isSceneryTransform(value) ? value : null;
      } else {
        meta[key] = value as CanvasMeta[typeof key];
      }
    }
  }
  return meta;
}

export function defaultSceneryTransform(
  stageWidth: number,
  stageHeight: number,
  imageWidth: number,
  imageHeight: number,
): SceneryTransform {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {
      x: 0,
      y: 0,
      width: Math.max(stageWidth, 1),
      height: Math.max(stageHeight, 1),
      scaleX: 1,
      scaleY: 1,
    };
  }
  const fitScale =
    Math.min(stageWidth / imageWidth, stageHeight / imageHeight) * 0.9;
  return {
    x: (stageWidth - imageWidth * fitScale) / 2,
    y: (stageHeight - imageHeight * fitScale) / 2,
    width: imageWidth,
    height: imageHeight,
    scaleX: fitScale,
    scaleY: fitScale,
  };
}

/** Read synthesis metadata from persisted canvas_state (wrapper or legacy top-level). */
export function extractCanvasMeta(
  raw: Record<string, unknown> | null | undefined,
): CanvasMeta {
  if (!raw || typeof raw !== "object") return {};
  if (raw.meta && typeof raw.meta === "object") {
    return pickMeta(raw.meta as Record<string, unknown>);
  }
  return pickMeta(raw);
}

/** Konva stage JSON from canvas_state (wrapper or legacy root Stage). */
export function extractKonvaStage(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  if (isKonvaStage(raw.stage)) {
    return raw.stage as Record<string, unknown>;
  }
  if (isKonvaStage(raw)) {
    return raw;
  }
  return null;
}

export function buildCanvasState(
  stage: Record<string, unknown>,
  meta: CanvasMeta,
): Record<string, unknown> {
  return { stage, meta };
}

function isWrappedCanvasState(value: Record<string, unknown>): boolean {
  return isKonvaStage(value.stage);
}

/** Preserve synthesis metadata when persisting Konva stage JSON from the client. */
export function mergeCanvasStateForPersist(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (isWrappedCanvasState(incoming)) {
    const stage = incoming.stage as Record<string, unknown>;
    const meta = {
      ...extractCanvasMeta(existing),
      ...extractCanvasMeta(incoming),
    };
    return buildCanvasState(stage, meta);
  }
  return buildCanvasState(incoming, extractCanvasMeta(existing));
}

/** Apply metadata patches while keeping the Konva stage subtree intact. */
export function patchCanvasMeta(
  existing: Record<string, unknown> | null | undefined,
  patch: Partial<CanvasMeta>,
): Record<string, unknown> {
  const stage = extractKonvaStage(existing);
  const meta = { ...extractCanvasMeta(existing), ...patch };
  if (stage) {
    return buildCanvasState(stage, meta);
  }
  return { ...(existing ?? {}), ...meta };
}

function walkNodes(
  node: KonvaNode,
  onLine: (line: ParsedCanvasLine) => void,
): void {
  if (node.className === "Line" && node.attrs) {
    const points = node.attrs.points;
    if (
      Array.isArray(points) &&
      points.length >= 2 &&
      points.every((n) => typeof n === "number")
    ) {
      const id =
        typeof node.attrs.id === "string" && node.attrs.id.length > 0
          ? node.attrs.id
          : crypto.randomUUID();
      onLine({ id, points: points as number[] });
    }
  }
  for (const child of node.children ?? []) {
    walkNodes(child, onLine);
  }
}

/** Restore brush lines and stage viewport from Konva `stage.toJSON()` output. */
export function parseKonvaCanvasState(
  raw: Record<string, unknown> | null | undefined,
): ParsedCanvasState | null {
  const stage = extractKonvaStage(raw);
  if (!stage || Object.keys(stage).length === 0) return null;

  const root = stage as KonvaNode;
  const lines: ParsedCanvasLine[] = [];
  walkNodes(root, (line) => lines.push(line));

  const attrs = root.attrs ?? {};
  const scaleX =
    typeof attrs.scaleX === "number" && attrs.scaleX > 0 ? attrs.scaleX : 1;

  return {
    lines,
    viewport: {
      x: typeof attrs.x === "number" ? attrs.x : 0,
      y: typeof attrs.y === "number" ? attrs.y : 0,
      scale: scaleX,
    },
  };
}
