/** Scenery / synthesis fields stored beside Konva stage JSON in `projects.canvas_state`. */
export type SagaCanvasMeta = {
  scenery_preview_url?: string | null;
  scenery_request_id?: string | null;
  depth_preview_url?: string | null;
  last_synthesis_at?: string | null;
};

const SAGA_META_KEY = "_saga";

export function getSagaCanvasMeta(
  canvasState: Record<string, unknown> | null | undefined,
): SagaCanvasMeta {
  if (!canvasState || typeof canvasState !== "object") return {};
  const raw = canvasState[SAGA_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const m = raw as Record<string, unknown>;
  return {
    scenery_preview_url:
      typeof m.scenery_preview_url === "string" ? m.scenery_preview_url : null,
    scenery_request_id:
      typeof m.scenery_request_id === "string" ? m.scenery_request_id : null,
    depth_preview_url:
      typeof m.depth_preview_url === "string" ? m.depth_preview_url : null,
    last_synthesis_at:
      typeof m.last_synthesis_at === "string" ? m.last_synthesis_at : null,
  };
}

export function mergeCanvasStateWithMeta(
  canvasState: Record<string, unknown> | null | undefined,
  meta: SagaCanvasMeta,
): Record<string, unknown> {
  const base =
    canvasState && typeof canvasState === "object" && !Array.isArray(canvasState)
      ? { ...canvasState }
      : {};
  return {
    ...base,
    [SAGA_META_KEY]: {
      ...getSagaCanvasMeta(base),
      ...meta,
    },
  };
}

/** Keep `_saga` when persisting Konva `stage.toJSON()` output. */
export function mergeKonvaStatePreservingMeta(
  existing: Record<string, unknown> | null | undefined,
  konvaState: Record<string, unknown>,
): Record<string, unknown> {
  const meta = getSagaCanvasMeta(existing);
  if (Object.keys(meta).length === 0) return konvaState;
  return {
    ...konvaState,
    [SAGA_META_KEY]: meta,
  };
}

export function isSceneryPending(meta: SagaCanvasMeta): boolean {
  return meta.scenery_preview_url === "pending";
}

export function sceneryDisplayUrl(meta: SagaCanvasMeta): string | null {
  const url = meta.scenery_preview_url;
  if (!url || url === "pending") return null;
  return url;
}
