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

export interface CanvasMeta {
  scenery_preview_url?: string | null;
  depth_preview_url?: string | null;
  scenery_fal_request_id?: string | null;
  last_synthesis_at?: string | null;
}

const META_KEYS: (keyof CanvasMeta)[] = [
  "scenery_preview_url",
  "depth_preview_url",
  "scenery_fal_request_id",
  "last_synthesis_at",
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

function pickMeta(source: Record<string, unknown>): CanvasMeta {
  const meta: CanvasMeta = {};
  for (const key of META_KEYS) {
    if (key in source) {
      meta[key] = source[key] as CanvasMeta[typeof key];
    }
  }
  return meta;
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

/** Preserve synthesis metadata when persisting Konva stage JSON from the client. */
export function mergeCanvasStateForPersist(
  existing: Record<string, unknown> | null | undefined,
  newStage: Record<string, unknown>,
): Record<string, unknown> {
  return buildCanvasState(newStage, extractCanvasMeta(existing));
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
