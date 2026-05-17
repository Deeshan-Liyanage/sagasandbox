"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Stage,
  Layer,
  Line,
  Circle,
  Text,
  Group,
  Image as KonvaImage,
  Rect,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import type { LocationPin } from "@/types/app";
import { GEN_STATUS_COLORS } from "@/lib/constants";
import {
  broadcastCanvasOp,
  type CanvasOpPayload,
} from "@/hooks/useRealtime";
import {
  buildCanvasState,
  defaultSceneryTransform,
  extractCanvasMeta,
  MIN_SCENERY_SIZE,
  normalizeSceneryTransform,
  parseKonvaCanvasState,
  type CanvasMeta,
  type SceneryTransform,
} from "@/lib/canvas-state";
import { findLinesNearPoint } from "@/lib/canvas-eraser";
import {
  isSceneryPreviewResolved,
  SCENERY_ERROR,
  SCENERY_PENDING,
  SCENERY_SYNTHESIS_TIMEOUT_MS,
} from "@/lib/scenery-synthesis";
import { cn } from "@/lib/cn";
import { exportMapSketchToDataUrl } from "@/lib/canvas-sketch-export";
import { buildGeospatialContext } from "@/lib/scenery-geospatial";
import {
  pipelineStageLabel,
  type SceneryPipelineStage,
} from "@/lib/scenery-pipeline-types";
import type { SceneryLayoutPlan } from "@/lib/scenery-layout-plan";
import { readApiError } from "@/lib/project-api";
import { toastError, toastSuccess } from "@/store/toast-store";
import { useCanvasAdvancedMode } from "@/hooks/useCanvasAdvancedMode";
import { PinCreator } from "./PinCreator";
import { SceneryPromptPreviewModal } from "./SceneryPromptPreviewModal";

/** Map = draw + pins + gestures; Eraser / Scenery are optional overlays. */
export type CanvasTool = "map" | "eraser" | "scenery";

export interface GeographyCanvasProps {
  projectId: string;
  pins: LocationPin[];
  onPinsChange: Dispatch<SetStateAction<LocationPin[]>>;
  onPinSelect: (pin: LocationPin) => void;
  onCanvasChange: (konvaJson: object) => void;
  initialCanvasState?: Record<string, unknown> | null;
  onHydrated?: () => void;
  loading?: boolean;
  userId?: string;
  apiAvailable?: boolean;
  highlightedPinId?: string | null;
}

export interface GeographyCanvasHandle {
  applyCanvasOp: (op: CanvasOpPayload) => void;
  hydrateFromState: (state: Record<string, unknown> | null | undefined) => void;
}

interface BrushLine {
  id: string;
  points: number[];
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const CURSOR_STALE_MS = 4000;
const CURSOR_BROADCAST_MS = 80;
const ERASER_RADIUS_BASE = 20;
const SCENERY_OPACITY = 0.55;
const DRAW_THRESHOLD_PX = 6;
const DBL_CLICK_PAN_MS = 500;

interface PeerCursor {
  x: number;
  y: number;
  updatedAt: number;
}

function pinColor(status: LocationPin["gen_status"]) {
  return GEN_STATUS_COLORS[status] ?? "#F59E0B";
}

function toolCursor(
  tool: CanvasTool,
  panModifierHeld: boolean,
  isPanning: boolean,
): string {
  if (isPanning || panModifierHeld) return "cursor-grabbing";
  if (tool === "eraser") return "cursor-cell";
  if (tool === "scenery") return "cursor-move";
  return "cursor-crosshair";
}

function isPanButton(button: number) {
  return button === 1 || button === 2;
}

function isTextInputActive(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable
  );
}

function shouldStartPan(
  button: number,
  modifiers: {
    space: boolean;
    alt: boolean;
    shift: boolean;
    dblClickWindow: boolean;
  },
) {
  return (
    modifiers.space ||
    modifiers.alt ||
    modifiers.shift ||
    isPanButton(button) ||
    modifiers.dblClickWindow
  );
}

function pointerClientXY(evt: MouseEvent | TouchEvent) {
  if ("touches" in evt && evt.touches.length > 0) {
    return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
  }
  if ("changedTouches" in evt && evt.changedTouches.length > 0) {
    return {
      x: evt.changedTouches[0].clientX,
      y: evt.changedTouches[0].clientY,
    };
  }
  return { x: (evt as MouseEvent).clientX, y: (evt as MouseEvent).clientY };
}

export const GeographyCanvas = forwardRef<
  GeographyCanvasHandle,
  GeographyCanvasProps
>(function GeographyCanvas(
  {
    projectId,
    pins,
    onPinsChange,
    onPinSelect,
    onCanvasChange,
    initialCanvasState = null,
    onHydrated,
    loading = false,
    userId = "local",
    apiAvailable = true,
    highlightedPinId = null,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const sceneryImageRef = useRef<Konva.Image>(null);
  const sceneryTransformerRef = useRef<Konva.Transformer>(null);
  const canvasMetaRef = useRef<CanvasMeta>({});
  const cursorThrottleRef = useRef(0);
  const hydratedStateKeyRef = useRef<string | null>(null);
  const sceneryPendingStartedRef = useRef<number | null>(null);
  const lastSceneryUrlRef = useRef<string | null>(null);
  const panSessionRef = useRef<{
    startClientX: number;
    startClientY: number;
    stageX: number;
    stageY: number;
  } | null>(null);
  const pointerSessionRef = useRef<{
    clientX: number;
    clientY: number;
    stageX: number;
    stageY: number;
  } | null>(null);
  const dblClickPanUntilRef = useRef(0);
  const spaceHeldRef = useRef(false);
  const altHeldRef = useRef(false);
  const shiftHeldRef = useRef(false);
  const panWindowCleanupRef = useRef<(() => void) | null>(null);
  /** Skips scenery layout sync while Konva is mid drag/transform. */
  const sceneryInteractingRef = useRef(false);

  const [size, setSize] = useState({ width: 800, height: 600 });
  const [tool, setTool] = useState<CanvasTool>("map");
  /** Drives pin draggable off while Space / Alt / Shift pan modifiers are held. */
  const [panModifierHeld, setPanModifierHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [lines, setLines] = useState<BrushLine[]>([]);
  const [peerCursors, setPeerCursors] = useState<Record<string, PeerCursor>>(
    {},
  );
  const [drawing, setDrawing] = useState(false);
  const [drawExceededThreshold, setDrawExceededThreshold] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [pinCreator, setPinCreator] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [promptPreviewLoading, setPromptPreviewLoading] = useState(false);
  const [promptPreviewDefault, setPromptPreviewDefault] = useState<
    string | null
  >(null);
  const { advancedMode, toggleAdvancedMode } = useCanvasAdvancedMode(projectId);
  const [promptPreviewWarnings, setPromptPreviewWarnings] = useState<string[]>(
    [],
  );
  const [promptPreviewLayoutPlan, setPromptPreviewLayoutPlan] =
    useState<SceneryLayoutPlan | null>(null);
  const [promptPreviewWireframe, setPromptPreviewWireframe] = useState<
    string | null
  >(null);
  const [sceneryPipelineStage, setSceneryPipelineStage] =
    useState<SceneryPipelineStage | null>(null);
  const [synthesisUserNotes, setSynthesisUserNotes] = useState("");
  const [sceneryPreviewUrl, setSceneryPreviewUrl] = useState<string | null>(
    null,
  );
  const [depthPreviewUrl, setDepthPreviewUrl] = useState<string | null>(null);
  const [sceneryImage, setSceneryImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [sceneryTransform, setSceneryTransform] =
    useState<SceneryTransform | null>(null);

  const sceneryImageUrl = isSceneryPreviewResolved(sceneryPreviewUrl)
    ? sceneryPreviewUrl
    : null;
  const hasSceneryImage = Boolean(sceneryImage && sceneryTransform);

  const persistCanvas = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    onCanvasChange(
      buildCanvasState(
        JSON.parse(stage.toJSON()) as Record<string, unknown>,
        canvasMetaRef.current,
      ) as object,
    );
  }, [onCanvasChange]);

  const persistSynthesisNotes = useCallback(
    (notes: string) => {
      const trimmed = notes.trim();
      canvasMetaRef.current = {
        ...canvasMetaRef.current,
        synthesis_user_notes: trimmed.length > 0 ? trimmed : null,
      };
      persistCanvas();
    },
    [persistCanvas],
  );

  const applySceneryTransform = useCallback(
    (transform: SceneryTransform) => {
      const normalized = normalizeSceneryTransform(transform);
      setSceneryTransform(normalized);
      canvasMetaRef.current = {
        ...canvasMetaRef.current,
        scenery_transform: normalized,
      };
      persistCanvas();
    },
    [persistCanvas],
  );

  const bakeSceneryNodeTransform = useCallback((node: Konva.Image): SceneryTransform => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    return normalizeSceneryTransform({
      x: node.x(),
      y: node.y(),
      width: node.width() * scaleX,
      height: node.height() * scaleY,
      scaleX: 1,
      scaleY: 1,
    });
  }, []);

  const applySceneryNodeTransform = useCallback(
    (node: Konva.Image, transform: SceneryTransform) => {
      node.x(transform.x);
      node.y(transform.y);
      node.width(transform.width);
      node.height(transform.height);
      node.scaleX(1);
      node.scaleY(1);
      node.getLayer()?.batchDraw();
    },
    [],
  );

  const syncSceneryNodeFromTransform = useCallback(
    (transform: SceneryTransform) => {
      const node = sceneryImageRef.current;
      if (!node || sceneryInteractingRef.current) return;
      applySceneryNodeTransform(node, transform);
    },
    [applySceneryNodeTransform],
  );

  const persistPinPosition = useCallback(
    async (pin: LocationPin, canvas_x: number, canvas_y: number) => {
      onPinsChange((prev) =>
        prev.map((p) =>
          p.id === pin.id ? { ...p, canvas_x, canvas_y } : p,
        ),
      );
      if (highlightedPinId === pin.id) {
        onPinSelect({ ...pin, canvas_x, canvas_y });
      }
      if (!apiAvailable) return;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/pins/${pin.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ canvas_x, canvas_y }),
          },
        );
        if (!res.ok) {
          throw new Error(await readApiError(res, "Failed to move pin"));
        }
        const { pin: updated } = (await res.json()) as { pin: LocationPin };
        onPinsChange((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Failed to move pin");
        onPinsChange((prev) =>
          prev.map((p) => (p.id === pin.id ? pin : p)),
        );
      }
    },
    [
      apiAvailable,
      projectId,
      onPinsChange,
      onPinSelect,
      highlightedPinId,
    ],
  );

  const hydrateFromState = useCallback(
    (state: Record<string, unknown> | null | undefined) => {
      const parsed = parseKonvaCanvasState(state);
      const meta = extractCanvasMeta(state);
      canvasMetaRef.current = meta;
      setSceneryPreviewUrl(meta.scenery_preview_url ?? null);
      setSceneryPipelineStage(meta.scenery_pipeline_stage ?? null);
      setDepthPreviewUrl(meta.depth_preview_url ?? null);
      setSynthesisUserNotes(meta.synthesis_user_notes ?? "");
      setSceneryTransform(
        meta.scenery_transform
          ? normalizeSceneryTransform(meta.scenery_transform)
          : null,
      );

      if (!parsed) {
        onHydrated?.();
        return;
      }
      setLines(parsed.lines);
      setStagePos({ x: parsed.viewport.x, y: parsed.viewport.y });
      setScale(parsed.viewport.scale);
      onHydrated?.();
    },
    [onHydrated],
  );

  const applyCanvasOp = useCallback(
    (op: CanvasOpPayload) => {
      if (op.user_id === userId) return;

      switch (op.op) {
        case "add":
        case "modify": {
          const points = op.payload.points;
          if (
            !Array.isArray(points) ||
            points.some((n) => typeof n !== "number")
          ) {
            return;
          }
          setLines((prev) => {
            const idx = prev.findIndex((l) => l.id === op.object_id);
            if (idx === -1) {
              return [...prev, { id: op.object_id, points: points as number[] }];
            }
            return prev.map((line) =>
              line.id === op.object_id
                ? { ...line, points: points as number[] }
                : line,
            );
          });
          break;
        }
        case "delete":
          setLines((prev) => prev.filter((l) => l.id !== op.object_id));
          break;
        case "cursor": {
          const x = op.payload.x;
          const y = op.payload.y;
          if (typeof x !== "number" || typeof y !== "number") return;
          setPeerCursors((prev) => ({
            ...prev,
            [op.user_id]: { x, y, updatedAt: Date.now() },
          }));
          break;
        }
        default:
          break;
      }
    },
    [userId],
  );

  useImperativeHandle(
    ref,
    () => ({ applyCanvasOp, hydrateFromState }),
    [applyCanvasOp, hydrateFromState],
  );

  useEffect(() => {
    const stateKey = JSON.stringify(initialCanvasState ?? null);
    if (hydratedStateKeyRef.current === stateKey) return;
    hydratedStateKeyRef.current = stateKey;
    hydrateFromState(initialCanvasState);
  }, [initialCanvasState, hydrateFromState]);

  useEffect(() => {
    if (sceneryTransform) {
      syncSceneryNodeFromTransform(sceneryTransform);
    }
  }, [sceneryTransform, syncSceneryNodeFromTransform]);

  /** Imperative viewport — avoids react-konva resetting position on unrelated re-renders during pan. */
  useLayoutEffect(() => {
    if (panSessionRef.current || isPanning) return;
    const stage = stageRef.current;
    if (!stage) return;
    stage.position({ x: stagePos.x, y: stagePos.y });
    stage.scale({ x: scale, y: scale });
    stage.batchDraw();
  }, [stagePos, scale, isPanning]);

  useEffect(() => {
    return () => {
      panWindowCleanupRef.current?.();
      panWindowCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sceneryImageUrl) {
      setSceneryImage(null);
      lastSceneryUrlRef.current = null;
      return;
    }

    const urlChanged = sceneryImageUrl !== lastSceneryUrlRef.current;
    lastSceneryUrlRef.current = sceneryImageUrl;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setSceneryImage(img);
      if (urlChanged || !canvasMetaRef.current.scenery_transform) {
        const next = defaultSceneryTransform(
          size.width,
          size.height,
          img.naturalWidth,
          img.naturalHeight,
        );
        setSceneryTransform(next);
        canvasMetaRef.current = {
          ...canvasMetaRef.current,
          scenery_transform: next,
        };
      }
    };
    img.onerror = () => setSceneryImage(null);
    img.src = sceneryImageUrl;
  }, [sceneryImageUrl, size.width, size.height]);

  useEffect(() => {
    if (tool !== "scenery" || !sceneryImageRef.current || !sceneryTransformerRef.current) {
      sceneryTransformerRef.current?.nodes([]);
      sceneryTransformerRef.current?.getLayer()?.batchDraw();
      return;
    }
    sceneryTransformerRef.current.nodes([sceneryImageRef.current]);
    sceneryTransformerRef.current.getLayer()?.batchDraw();
  }, [tool, hasSceneryImage]);

  useEffect(() => {
    if (sceneryPreviewUrl !== SCENERY_PENDING || !apiAvailable) {
      sceneryPendingStartedRef.current = null;
      return;
    }

    if (sceneryPendingStartedRef.current === null) {
      sceneryPendingStartedRef.current = Date.now();
    }

    let cancelled = false;

    const applyMeta = (meta: {
      scenery_preview_url?: string | null;
      depth_preview_url?: string | null;
      scenery_transform?: SceneryTransform | null;
      scenery_pipeline_stage?: SceneryPipelineStage | null;
    }) => {
      if (meta.scenery_pipeline_stage) {
        setSceneryPipelineStage(meta.scenery_pipeline_stage);
      }
      if (meta.depth_preview_url) {
        setDepthPreviewUrl(meta.depth_preview_url);
      }
      if (meta.scenery_transform) {
        const normalized = normalizeSceneryTransform(meta.scenery_transform);
        setSceneryTransform(normalized);
        canvasMetaRef.current = {
          ...canvasMetaRef.current,
          scenery_transform: normalized,
        };
      }
      if (isSceneryPreviewResolved(meta.scenery_preview_url)) {
        setSceneryPreviewUrl(meta.scenery_preview_url!);
        sceneryPendingStartedRef.current = null;
        toastSuccess("Scenery synthesis complete");
        return true;
      }
      if (meta.scenery_preview_url === SCENERY_ERROR) {
        setSceneryPreviewUrl(null);
        sceneryPendingStartedRef.current = null;
        toastError("Scenery generation failed. Try again.");
        return true;
      }
      return false;
    };

    const poll = async () => {
      const startedAt = sceneryPendingStartedRef.current;
      if (
        startedAt !== null &&
        Date.now() - startedAt > SCENERY_SYNTHESIS_TIMEOUT_MS
      ) {
        if (!cancelled) {
          setSceneryPreviewUrl(null);
          sceneryPendingStartedRef.current = null;
          toastError(
            "Scenery generation timed out. Check FAL_KEY and webhook URL, then try again.",
          );
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/projects/${projectId}/canvas/synthesize/status`,
        );
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as {
          status: "idle" | "pending" | "complete" | "error";
          canvas_meta?: {
            scenery_preview_url?: string | null;
            depth_preview_url?: string | null;
            scenery_transform?: SceneryTransform | null;
          };
        };

        if (data.canvas_meta && applyMeta(data.canvas_meta)) return;

        if (data.status === "error" && !cancelled) {
          setSceneryPreviewUrl(null);
          sceneryPendingStartedRef.current = null;
          toastError("Scenery generation failed. Try again.");
        }
      } catch {
        // ignore transient poll errors
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sceneryPreviewUrl, apiAvailable, projectId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - CURSOR_STALE_MS;
      setPeerCursors((prev) => {
        const next: Record<string, PeerCursor> = {};
        let changed = false;
        for (const [id, cursor] of Object.entries(prev)) {
          if (cursor.updatedAt >= cutoff) {
            next[id] = cursor;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      if (tool === "scenery") return;
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, oldScale * (1 + direction * 0.08)),
      );

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      setScale(newScale);
      setStagePos(newPos);
      persistCanvas();
    },
    [tool, persistCanvas],
  );

  const getStagePoint = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pos);
  }, []);

  const endPanSession = useCallback(() => {
    panWindowCleanupRef.current?.();
    panWindowCleanupRef.current = null;
    panSessionRef.current = null;
    setIsPanning(false);
  }, []);

  const beginPan = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage || panSessionRef.current) return;

      pointerSessionRef.current = null;
      setDrawing(false);
      setErasing(false);
      setCurrentLineId(null);

      panSessionRef.current = {
        startClientX: clientX,
        startClientY: clientY,
        stageX: stage.x(),
        stageY: stage.y(),
      };
      setIsPanning(true);

      const onWindowMove = (e: MouseEvent | TouchEvent) => {
        const session = panSessionRef.current;
        const activeStage = stageRef.current;
        if (!session || !activeStage) return;

        const { x: cx, y: cy } = pointerClientXY(e);
        const next = {
          x: session.stageX + (cx - session.startClientX),
          y: session.stageY + (cy - session.startClientY),
        };
        activeStage.position(next);
        setStagePos(next);
        activeStage.batchDraw();
      };

      const onWindowUp = () => {
        const activeStage = stageRef.current;
        if (activeStage && panSessionRef.current) {
          const pos = activeStage.position();
          setStagePos({ x: pos.x, y: pos.y });
          persistCanvas();
        }
        endPanSession();
      };

      window.addEventListener("mousemove", onWindowMove);
      window.addEventListener("mouseup", onWindowUp);
      window.addEventListener("touchmove", onWindowMove, { passive: false });
      window.addEventListener("touchend", onWindowUp);
      window.addEventListener("touchcancel", onWindowUp);
      panWindowCleanupRef.current = () => {
        window.removeEventListener("mousemove", onWindowMove);
        window.removeEventListener("mouseup", onWindowUp);
        window.removeEventListener("touchmove", onWindowMove);
        window.removeEventListener("touchend", onWindowUp);
        window.removeEventListener("touchcancel", onWindowUp);
      };
    },
    [endPanSession, persistCanvas],
  );

  const syncPanModifierHeld = useCallback(() => {
    setPanModifierHeld(
      spaceHeldRef.current || altHeldRef.current || shiftHeldRef.current,
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        if (isTextInputActive()) return;
        if (
          containerRef.current?.contains(document.activeElement) ||
          document.activeElement === document.body
        ) {
          e.preventDefault();
        }
        spaceHeldRef.current = true;
        syncPanModifierHeld();
      }
      if (e.key === "Alt") {
        altHeldRef.current = true;
        syncPanModifierHeld();
      }
      if (e.key === "Shift") {
        shiftHeldRef.current = true;
        syncPanModifierHeld();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
        syncPanModifierHeld();
        endPanSession();
      }
      if (e.key === "Alt") {
        altHeldRef.current = false;
        syncPanModifierHeld();
      }
      if (e.key === "Shift") {
        shiftHeldRef.current = false;
        syncPanModifierHeld();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [endPanSession, syncPanModifierHeld]);

  const eraseAtPoint = useCallback(
    (point: { x: number; y: number }) => {
      const radius = ERASER_RADIUS_BASE / scale;
      setLines((prev) => {
        const hitIds = new Set(
          findLinesNearPoint(prev, point, radius, (line) => line.id),
        );
        if (hitIds.size === 0) return prev;
        for (const id of hitIds) {
          void broadcastCanvasOp(projectId, {
            op: "delete",
            user_id: userId,
            object_id: id,
            payload: {},
          });
        }
        return prev.filter((line) => !hitIds.has(line.id));
      });
    },
    [projectId, scale, userId],
  );

  const handlePointerDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const evt = e.evt;
      const clientX =
        "clientX" in evt ? evt.clientX : evt.touches[0]?.clientX ?? 0;
      const clientY =
        "clientY" in evt ? evt.clientY : evt.touches[0]?.clientY ?? 0;
      const button = "button" in evt ? evt.button : 0;

      if (isPanButton(button)) {
        evt.preventDefault();
      }

      const panGesture = shouldStartPan(button, {
        space: spaceHeldRef.current,
        alt: altHeldRef.current,
        shift: shiftHeldRef.current,
        dblClickWindow: Date.now() < dblClickPanUntilRef.current,
      });

      if (panGesture) {
        beginPan(clientX, clientY);
        return;
      }

      if (tool === "scenery") return;

      const point = getStagePoint();
      if (!point) return;

      if (tool === "eraser") {
        setErasing(true);
        eraseAtPoint(point);
        return;
      }

      if (tool === "map") {
        pointerSessionRef.current = {
          clientX,
          clientY,
          stageX: point.x,
          stageY: point.y,
        };
        setDrawExceededThreshold(false);
      }
    },
    [tool, getStagePoint, eraseAtPoint, beginPan],
  );

  const broadcastCursor = useCallback(
    (point: { x: number; y: number }) => {
      const now = Date.now();
      if (now - cursorThrottleRef.current < CURSOR_BROADCAST_MS) return;
      cursorThrottleRef.current = now;
      void broadcastCanvasOp(projectId, {
        op: "cursor",
        user_id: userId,
        object_id: userId,
        payload: { x: point.x, y: point.y },
      });
    },
    [projectId, userId],
  );

  const handlePointerMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const evt = e.evt;
      const clientX =
        "clientX" in evt ? evt.clientX : evt.touches[0]?.clientX ?? 0;
      const clientY =
        "clientY" in evt ? evt.clientY : evt.touches[0]?.clientY ?? 0;

      if (panSessionRef.current) {
        return;
      }

      const point = getStagePoint();
      if (!point) return;

      if (tool === "map" && pointerSessionRef.current && !drawing) {
        const dx = clientX - pointerSessionRef.current.clientX;
        const dy = clientY - pointerSessionRef.current.clientY;
        if (Math.hypot(dx, dy) >= DRAW_THRESHOLD_PX) {
          setDrawExceededThreshold(true);
          const id = crypto.randomUUID();
          setCurrentLineId(id);
          setDrawing(true);
          setLines((prev) => [
            ...prev,
            {
              id,
              points: [
                pointerSessionRef.current!.stageX,
                pointerSessionRef.current!.stageY,
                point.x,
                point.y,
              ],
            },
          ]);
        }
      }

      if (drawing && currentLineId) {
        setLines((prev) =>
          prev.map((line) =>
            line.id === currentLineId
              ? { ...line, points: [...line.points, point.x, point.y] }
              : line,
          ),
        );
      }

      if (erasing && tool === "eraser") {
        eraseAtPoint(point);
      }

      broadcastCursor(point);
    },
    [
      tool,
      drawing,
      erasing,
      currentLineId,
      getStagePoint,
      eraseAtPoint,
      broadcastCursor,
    ],
  );

  const handlePointerUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (panSessionRef.current) {
        return;
      }

      if (drawing && currentLineId) {
        const line = lines.find((l) => l.id === currentLineId);
        if (line) {
          void broadcastCanvasOp(projectId, {
            op: "modify",
            user_id: userId,
            object_id: currentLineId,
            payload: { points: line.points },
          });
        }
        persistCanvas();
      } else if (
        tool === "map" &&
        pointerSessionRef.current &&
        !drawExceededThreshold
      ) {
        const clickedOnEmpty =
          e.target === e.target.getStage() ||
          e.target.getClassName() === "Layer";
        if (clickedOnEmpty) {
          setPinCreator({
            x: pointerSessionRef.current.stageX,
            y: pointerSessionRef.current.stageY,
          });
        }
      }

      if (erasing) {
        persistCanvas();
      }

      setDrawing(false);
      setErasing(false);
      setCurrentLineId(null);
      pointerSessionRef.current = null;
      setDrawExceededThreshold(false);
    },
    [
      drawing,
      erasing,
      tool,
      drawExceededThreshold,
      currentLineId,
      lines,
      projectId,
      userId,
      persistCanvas,
    ],
  );

  const setSceneryTransformLive = useCallback(
    (next: SceneryTransform) => {
      setSceneryTransform(next);
      canvasMetaRef.current = {
        ...canvasMetaRef.current,
        scenery_transform: next,
      };
    },
    [],
  );

  const handleSceneryDragStart = useCallback(() => {
    sceneryInteractingRef.current = true;
  }, []);

  const handleSceneryDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target as Konva.Image;
      setSceneryTransform((prev) => {
        if (!prev) return prev;
        const next = { ...prev, x: node.x(), y: node.y() };
        canvasMetaRef.current = {
          ...canvasMetaRef.current,
          scenery_transform: next,
        };
        return next;
      });
    },
    [],
  );

  const handleSceneryDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      sceneryInteractingRef.current = false;
      const node = e.target as Konva.Image;
      applySceneryTransform(bakeSceneryNodeTransform(node));
    },
    [bakeSceneryNodeTransform, applySceneryTransform],
  );

  const handleSceneryTransform = useCallback(() => {
    const node = sceneryImageRef.current;
    if (!node) return;
    sceneryInteractingRef.current = true;
    const next = bakeSceneryNodeTransform(node);
    applySceneryNodeTransform(node, next);
    setSceneryTransformLive(next);
  }, [bakeSceneryNodeTransform, applySceneryNodeTransform, setSceneryTransformLive]);

  const handleSceneryTransformEnd = useCallback(() => {
    sceneryInteractingRef.current = false;
    const node = sceneryImageRef.current;
    if (!node) return;

    const next = bakeSceneryNodeTransform(node);
    applySceneryNodeTransform(node, next);
    applySceneryTransform(next);

    requestAnimationFrame(() => {
      const tr = sceneryTransformerRef.current;
      if (tr && sceneryImageRef.current) {
        tr.nodes([sceneryImageRef.current]);
        tr.getLayer()?.batchDraw();
      }
    });
  }, [
    bakeSceneryNodeTransform,
    applySceneryNodeTransform,
    applySceneryTransform,
  ]);

  const handleStageDblClick = useCallback(() => {
    if (tool !== "map") return;
    dblClickPanUntilRef.current = Date.now() + DBL_CLICK_PAN_MS;
  }, [tool]);

  const handlePinCreated = useCallback(
    (pin: LocationPin) => {
      onPinsChange((prev) => [...prev, pin]);
      setPinCreator(null);
    },
    [onPinsChange],
  );

  const buildSynthesisRequestBody = useCallback(() => {
    const hasStrokes = lines.length > 0;
    const sketchDataUrl = hasStrokes
      ? exportMapSketchToDataUrl(
          lines,
          pins.map((p) => ({
            canvas_x: p.canvas_x,
            canvas_y: p.canvas_y,
            label: p.label,
          })),
        )
      : null;

    const notes = synthesisUserNotes.trim();
    const geospatial = buildGeospatialContext(
      lines,
      pins.map((p) => ({
        canvas_x: p.canvas_x,
        canvas_y: p.canvas_y,
        label: p.label,
        description: p.description,
      })),
      size.width,
      size.height,
    );

    return {
      hasStrokes,
      sketchDataUrl,
      notes,
      body: {
        sketch_data_url: sketchDataUrl ?? undefined,
        has_strokes: hasStrokes,
        synthesis_user_notes: notes.length > 0 ? notes : null,
        geospatial,
      },
    };
  }, [
    lines,
    pins,
    size.width,
    size.height,
    synthesisUserNotes,
  ]);

  const handleOpenSynthesisPreview = useCallback(async () => {
    if (!apiAvailable || synthesizing || promptPreviewLoading) return;

    const { hasStrokes, notes, body } = buildSynthesisRequestBody();

    if (!hasStrokes) {
      toastError(
        "No strokes on the map — synthesis will use theme and pin names only.",
      );
    }

    persistSynthesisNotes(notes);
    setPromptPreviewOpen(true);
    setPromptPreviewLoading(true);
    setPromptPreviewDefault(null);
    setPromptPreviewWarnings([]);
    setPromptPreviewLayoutPlan(null);
    setPromptPreviewWireframe(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/canvas/synthesize/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const data = (await res.json()) as {
        prompt?: string;
        default_prompt?: string;
        warnings?: string[];
        layout_plan?: SceneryLayoutPlan;
        wireframe_thumbnail?: string | null;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load prompt preview");
      }

      setPromptPreviewDefault(
        data.default_prompt ?? data.prompt ?? "",
      );
      setPromptPreviewWarnings(data.warnings ?? []);
      setPromptPreviewLayoutPlan(data.layout_plan ?? null);
      setPromptPreviewWireframe(data.wireframe_thumbnail ?? null);
    } catch (err) {
      setPromptPreviewOpen(false);
      toastError(
        err instanceof Error ? err.message : "Failed to load prompt preview",
      );
    } finally {
      setPromptPreviewLoading(false);
    }
  }, [
    apiAvailable,
    synthesizing,
    promptPreviewLoading,
    buildSynthesisRequestBody,
    persistSynthesisNotes,
    projectId,
  ]);

  const handleCloseSynthesisPreview = useCallback(() => {
    if (synthesizing) return;
    setPromptPreviewOpen(false);
    setPromptPreviewDefault(null);
    setPromptPreviewWarnings([]);
    setPromptPreviewLayoutPlan(null);
    setPromptPreviewWireframe(null);
  }, [synthesizing]);

  const handleSynthesizeScenery = useCallback(
    async (promptOverride?: string) => {
    if (!apiAvailable || synthesizing) return;

    const { hasStrokes, notes, body } = buildSynthesisRequestBody();

    if (!hasStrokes) {
      toastError(
        "No strokes on the map — synthesis will use theme and pin names only.",
      );
    }

    persistSynthesisNotes(notes);

    setSynthesizing(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/canvas/synthesize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            ...(promptOverride
              ? { prompt_override: promptOverride }
              : {}),
          }),
        },
      );

      const data = (await res.json()) as {
        queued?: boolean;
        message?: string;
        error?: string;
        used_sketch_reference?: boolean;
        warnings?: string[];
        canvas_meta?: CanvasMeta;
        depth_preview_url?: string | null;
        scenery_pipeline_stage?: string | null;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Scenery synthesis failed");
      }

      const meta = data.canvas_meta;
      if (meta) {
        canvasMetaRef.current = { ...canvasMetaRef.current, ...meta };
        if (meta.scenery_pipeline_stage) {
          setSceneryPipelineStage(meta.scenery_pipeline_stage);
        }
      }
      if (data.queued && meta?.scenery_preview_url === SCENERY_PENDING) {
        setSceneryPreviewUrl(SCENERY_PENDING);
        setSceneryPipelineStage(
          (meta?.scenery_pipeline_stage ??
            data.scenery_pipeline_stage ??
            "base") as SceneryPipelineStage,
        );
        sceneryPendingStartedRef.current = Date.now();
      } else if (isSceneryPreviewResolved(meta?.scenery_preview_url)) {
        setSceneryPreviewUrl(meta!.scenery_preview_url!);
      } else if (meta?.scenery_preview_url === SCENERY_ERROR) {
        setSceneryPreviewUrl(null);
      }

      const depth =
        meta?.depth_preview_url ?? data.depth_preview_url ?? null;
      if (depth) setDepthPreviewUrl(depth);

      for (const warning of data.warnings ?? []) {
        toastError(warning);
      }

      const previewResolved = isSceneryPreviewResolved(meta?.scenery_preview_url);
      const previewFailed = meta?.scenery_preview_url === SCENERY_ERROR;

      if (data.queued) {
        toastSuccess(
          data.used_sketch_reference
            ? (data.message ?? "Scenery queued from your map sketch")
            : (data.message ?? "Scenery generation queued (text only)"),
        );
      } else if (previewResolved) {
        toastSuccess(data.message ?? "Scenery synthesis complete");
      } else if (previewFailed) {
        toastError(
          data.message ?? "Scenery generation failed. Try again.",
        );
      } else {
        toastError(
          data.message ??
            "Scenery synthesis is unavailable. Configure FAL_KEY on the server.",
        );
      }
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Scenery synthesis failed",
      );
    } finally {
      setSynthesizing(false);
    }
  },
    [
      apiAvailable,
      synthesizing,
      projectId,
      buildSynthesisRequestBody,
      persistSynthesisNotes,
    ],
  );

  const handleConfirmSynthesisFromPreview = useCallback(
    (editedPrompt: string) => {
      void handleSynthesizeScenery(editedPrompt).finally(() => {
        setPromptPreviewOpen(false);
        setPromptPreviewDefault(null);
        setPromptPreviewWarnings([]);
      });
    },
    [handleSynthesizeScenery],
  );

  const handleSynthesizeClick = useCallback(() => {
    if (advancedMode) {
      void handleOpenSynthesisPreview();
    } else {
      void handleSynthesizeScenery();
    }
  }, [
    advancedMode,
    handleOpenSynthesisPreview,
    handleSynthesizeScenery,
  ]);

  const toolbar = useMemo(
    () => (
      <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e]/95 px-2 py-1 shadow-lg backdrop-blur">
        <span className="rounded-md bg-[#7c3aed] px-2.5 py-1 text-xs font-medium text-white">
          Map
        </span>
        <button
          type="button"
          onClick={() => setTool(tool === "eraser" ? "map" : "eraser")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium",
            tool === "eraser"
              ? "bg-[#7c3aed] text-white"
              : "text-[#9ca3af] hover:text-white",
          )}
        >
          Eraser
        </button>
        {hasSceneryImage ? (
          <button
            type="button"
            onClick={() => setTool(tool === "scenery" ? "map" : "scenery")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              tool === "scenery"
                ? "bg-[#7c3aed] text-white"
                : "text-[#9ca3af] hover:text-white",
            )}
          >
            Scenery
          </button>
        ) : null}
        {apiAvailable ? (
          <>
            <input
              type="text"
              value={synthesisUserNotes}
              onChange={(e) => setSynthesisUserNotes(e.target.value)}
              onBlur={() => persistSynthesisNotes(synthesisUserNotes)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Extra instructions (2D, watercolor…)"
              disabled={synthesizing}
              aria-label="Scenery synthesis instructions"
              className={cn(
                "w-36 min-w-0 rounded-md border border-[#2a2a2e] bg-[#0f0f12] px-2 py-1 text-xs text-[#e5e7eb] placeholder:text-[#6b7280] sm:w-48",
                synthesizing && "cursor-not-allowed opacity-60",
              )}
            />
            <button
              type="button"
              disabled={synthesizing || promptPreviewLoading}
              onClick={() => void handleSynthesizeClick()}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium text-[#a78bfa] hover:bg-[#7c3aed]/20",
                (synthesizing || promptPreviewLoading) &&
                  "cursor-wait opacity-60",
              )}
            >
              {synthesizing
                ? "Synthesizing…"
                : promptPreviewLoading
                  ? "Loading…"
                  : "Synthesize"}
            </button>
            <span className="mx-0.5 h-5 w-px bg-[#2a2a2e]" aria-hidden />
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#9ca3af] hover:text-[#e5e7eb]">
              <input
                type="checkbox"
                checked={advancedMode}
                onChange={toggleAdvancedMode}
                disabled={synthesizing}
                className="h-3.5 w-3.5 rounded border-[#2a2a2e] bg-[#0f0f12] text-[#7c3aed] focus:ring-[#7c3aed]/40"
              />
              Advanced
            </label>
          </>
        ) : null}
      </div>
    ),
    [
      tool,
      hasSceneryImage,
      apiAvailable,
      synthesizing,
      synthesisUserNotes,
      persistSynthesisNotes,
      handleSynthesizeClick,
      promptPreviewLoading,
      advancedMode,
      toggleAdvancedMode,
    ],
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative h-full w-full overflow-hidden bg-[#0e0e0f] outline-none"
      onPointerDown={() => containerRef.current?.focus({ preventScroll: true })}
    >
      <SceneryPromptPreviewModal
        key={promptPreviewDefault ?? (promptPreviewLoading ? "loading" : "empty")}
        open={promptPreviewOpen}
        loading={promptPreviewLoading}
        defaultPrompt={promptPreviewDefault}
        warnings={promptPreviewWarnings}
        layoutPlan={promptPreviewLayoutPlan}
        wireframeThumbnail={promptPreviewWireframe}
        confirming={synthesizing}
        onClose={handleCloseSynthesisPreview}
        onConfirm={handleConfirmSynthesisFromPreview}
      />
      {loading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0e0e0f]/80">
          <div className="h-48 w-full max-w-md animate-pulse rounded-lg bg-[#1a1a1e]" />
        </div>
      ) : null}
      {depthPreviewUrl && !hasSceneryImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={depthPreviewUrl}
          alt="Depth map preview"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-30 mix-blend-screen"
        />
      ) : null}
      {sceneryPreviewUrl === SCENERY_PENDING ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[2] rounded-md border border-[#7c3aed]/40 bg-[#7c3aed]/15 px-3 py-2 text-center text-xs text-[#e5e7eb]">
          <span className="inline-block animate-pulse">
            {pipelineStageLabel(sceneryPipelineStage)}
          </span>
        </div>
      ) : null}
      {tool === "map" ? (
        <p className="pointer-events-none absolute inset-x-4 bottom-20 z-[2] text-center text-[10px] text-[#6b7280]">
          Drag to draw · Click empty map to add pin · Hold Space, Alt, or Shift
          and drag to pan · Middle / right mouse drag to pan
        </p>
      ) : null}
      {toolbar}
      {pins.length === 0 && !pinCreator && tool === "map" ? (
        <p className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center text-sm text-[#9ca3af]">
          Click the map to add a location
        </p>
      ) : null}

      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={false}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onMousemove={handlePointerMove}
        onTouchMove={handlePointerMove}
        onMouseup={handlePointerUp}
        onTouchEnd={handlePointerUp}
        onDblClick={handleStageDblClick}
        onContextMenu={(e) => e.evt.preventDefault()}
        className={toolCursor(tool, panModifierHeld, isPanning)}
      >
        <Layer>
          {hasSceneryImage && sceneryTransform ? (
            <>
              <KonvaImage
                ref={sceneryImageRef}
                image={sceneryImage!}
                x={sceneryTransform.x}
                y={sceneryTransform.y}
                width={sceneryTransform.width}
                height={sceneryTransform.height}
                scaleX={1}
                scaleY={1}
                opacity={SCENERY_OPACITY}
                draggable={tool === "scenery"}
                listening={tool === "scenery"}
                onDragStart={handleSceneryDragStart}
                onDragMove={handleSceneryDragMove}
                onDragEnd={handleSceneryDragEnd}
                onTransform={handleSceneryTransform}
                onTransformEnd={handleSceneryTransformEnd}
              />
              {tool === "scenery" ? (
                <Rect
                  x={sceneryTransform.x}
                  y={sceneryTransform.y}
                  width={sceneryTransform.width}
                  height={sceneryTransform.height}
                  stroke="#7c3aed"
                  strokeWidth={2 / scale}
                  dash={[8 / scale, 4 / scale]}
                  listening={false}
                />
              ) : null}
              {tool === "scenery" ? (
                <Transformer
                  ref={sceneryTransformerRef}
                  rotateEnabled={false}
                  keepRatio={false}
                  borderStroke="#7c3aed"
                  anchorStroke="#a78bfa"
                  anchorFill="#1a1a1e"
                  boundBoxFunc={(oldBox, newBox) => {
                    if (
                      newBox.width < MIN_SCENERY_SIZE ||
                      newBox.height < MIN_SCENERY_SIZE
                    ) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                />
              ) : null}
            </>
          ) : null}
        </Layer>
        <Layer>
          {lines.map((line) => (
            <Line
              key={line.id}
              id={line.id}
              points={line.points}
              stroke="#7c3aed"
              strokeWidth={3 / scale}
              tension={0.4}
              lineCap="round"
              lineJoin="round"
              listening={tool !== "scenery"}
            />
          ))}
          {Object.entries(peerCursors).map(([peerId, cursor]) => (
            <Group key={`cursor-${peerId}`} x={cursor.x} y={cursor.y}>
              <Circle radius={6} fill="#10b981" stroke="#0e0e0f" strokeWidth={2} />
              <Text
                text="Collaborator"
                fontSize={10}
                fill="#10b981"
                y={10}
                offsetX={28}
              />
            </Group>
          ))}
          {pins.map((pin) => (
            <Group
              key={pin.id}
              x={pin.canvas_x}
              y={pin.canvas_y}
              draggable={
                tool === "map" && apiAvailable && !panModifierHeld
              }
              onDragStart={(e) => {
                e.cancelBubble = true;
                pointerSessionRef.current = null;
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                const node = e.target;
                void persistPinPosition(pin, node.x(), node.y());
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                onPinSelect(pin);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onPinSelect(pin);
              }}
            >
              <Circle
                radius={10}
                fill={pinColor(pin.gen_status)}
                stroke={highlightedPinId === pin.id ? "#7c3aed" : "#0e0e0f"}
                strokeWidth={highlightedPinId === pin.id ? 3 : 2}
                shadowBlur={pin.gen_status === "generating" ? 8 : 0}
              />
              <Text
                text={pin.label}
                fontSize={12}
                fill="#e5e7eb"
                y={14}
                offsetX={pin.label.length * 3}
              />
            </Group>
          ))}
        </Layer>
      </Stage>

      {pinCreator ? (
        <PinCreator
          projectId={projectId}
          canvasX={pinCreator.x}
          canvasY={pinCreator.y}
          apiAvailable={apiAvailable}
          onCreated={handlePinCreated}
          onCancel={() => setPinCreator(null)}
        />
      ) : null}
    </div>
  );
});
