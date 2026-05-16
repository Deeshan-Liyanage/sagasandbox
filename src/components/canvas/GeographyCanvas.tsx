"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
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
import { toastError, toastSuccess } from "@/store/toast-store";
import { PinCreator } from "./PinCreator";

export type CanvasTool = "brush" | "pan" | "eraser" | "scenery";

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

interface PeerCursor {
  x: number;
  y: number;
  updatedAt: number;
}

function pinColor(status: LocationPin["gen_status"]) {
  return GEN_STATUS_COLORS[status] ?? "#F59E0B";
}

function toolCursor(tool: CanvasTool): string {
  switch (tool) {
    case "pan":
      return "cursor-grab";
    case "eraser":
      return "cursor-cell";
    case "scenery":
      return "cursor-move";
    default:
      return "cursor-crosshair";
  }
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
  const sceneryGroupRef = useRef<Konva.Group>(null);
  const sceneryTransformerRef = useRef<Konva.Transformer>(null);
  const canvasMetaRef = useRef<CanvasMeta>({});
  const cursorThrottleRef = useRef(0);
  const hydratedStateKeyRef = useRef<string | null>(null);
  const sceneryPendingStartedRef = useRef<number | null>(null);
  const lastSceneryUrlRef = useRef<string | null>(null);

  const [size, setSize] = useState({ width: 800, height: 600 });
  const [tool, setTool] = useState<CanvasTool>("brush");
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [lines, setLines] = useState<BrushLine[]>([]);
  const [peerCursors, setPeerCursors] = useState<Record<string, PeerCursor>>(
    {},
  );
  const [drawing, setDrawing] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [pinCreator, setPinCreator] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
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

  const applySceneryTransform = useCallback(
    (transform: SceneryTransform) => {
      setSceneryTransform(transform);
      canvasMetaRef.current = {
        ...canvasMetaRef.current,
        scenery_transform: transform,
      };
      persistCanvas();
    },
    [persistCanvas],
  );

  const hydrateFromState = useCallback(
    (state: Record<string, unknown> | null | undefined) => {
      const parsed = parseKonvaCanvasState(state);
      const meta = extractCanvasMeta(state);
      canvasMetaRef.current = meta;
      setSceneryPreviewUrl(meta.scenery_preview_url ?? null);
      setDepthPreviewUrl(meta.depth_preview_url ?? null);
      setSceneryTransform(meta.scenery_transform ?? null);

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
    if (tool !== "scenery" || !sceneryGroupRef.current || !sceneryTransformerRef.current) {
      sceneryTransformerRef.current?.nodes([]);
      sceneryTransformerRef.current?.getLayer()?.batchDraw();
      return;
    }
    sceneryTransformerRef.current.nodes([sceneryGroupRef.current]);
    sceneryTransformerRef.current.getLayer()?.batchDraw();
  }, [tool, hasSceneryImage, sceneryTransform]);

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
    }) => {
      if (meta.depth_preview_url) {
        setDepthPreviewUrl(meta.depth_preview_url);
      }
      if (meta.scenery_transform) {
        setSceneryTransform(meta.scenery_transform);
        canvasMetaRef.current = {
          ...canvasMetaRef.current,
          scenery_transform: meta.scenery_transform,
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

  const handlePointerDown = useCallback(() => {
    if (tool === "pan" || tool === "scenery") return;
    const point = getStagePoint();
    if (!point) return;

    if (tool === "brush") {
      const id = crypto.randomUUID();
      setCurrentLineId(id);
      setDrawing(true);
      setLines((prev) => [...prev, { id, points: [point.x, point.y] }]);
      return;
    }

    if (tool === "eraser") {
      setErasing(true);
      eraseAtPoint(point);
    }
  }, [tool, getStagePoint, eraseAtPoint]);

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

  const handlePointerMove = useCallback(() => {
    const point = getStagePoint();
    if (!point) return;

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
  }, [
    drawing,
    erasing,
    tool,
    currentLineId,
    getStagePoint,
    eraseAtPoint,
    broadcastCursor,
  ]);

  const handlePointerUp = useCallback(() => {
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
    }
    if (erasing) {
      persistCanvas();
    }
    setDrawing(false);
    setErasing(false);
    setCurrentLineId(null);
  }, [
    drawing,
    erasing,
    currentLineId,
    lines,
    projectId,
    userId,
    persistCanvas,
  ]);

  const handleSceneryDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!sceneryTransform) return;
      const node = e.target;
      applySceneryTransform({
        ...sceneryTransform,
        x: node.x(),
        y: node.y(),
      });
    },
    [sceneryTransform, applySceneryTransform],
  );

  const handleSceneryTransformEnd = useCallback(() => {
    const node = sceneryGroupRef.current;
    if (!node || !sceneryTransform) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    applySceneryTransform({
      x: node.x(),
      y: node.y(),
      width: Math.max(node.width() * scaleX, 1),
      height: Math.max(node.height() * scaleY, 1),
      scaleX: 1,
      scaleY: 1,
    });
    node.scaleX(1);
    node.scaleY(1);
  }, [sceneryTransform, applySceneryTransform]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool !== "brush") return;
      const clickedOnEmpty =
        e.target === e.target.getStage() ||
        e.target.getClassName() === "Layer";
      if (!clickedOnEmpty) return;
      const point = getStagePoint();
      if (!point) return;
      setPinCreator({ x: point.x, y: point.y });
    },
    [tool, getStagePoint],
  );

  const handlePinCreated = useCallback(
    (pin: LocationPin) => {
      onPinsChange((prev) => [...prev, pin]);
      setPinCreator(null);
    },
    [onPinsChange],
  );

  const handleSynthesizeScenery = useCallback(async () => {
    if (!apiAvailable || synthesizing) return;

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

    if (!hasStrokes) {
      toastError(
        "No strokes on the map — synthesis will use theme and pin names only.",
      );
    }

    setSynthesizing(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/canvas/synthesize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sketch_description:
              "Cinematic geography map backdrop faithful to the sketched terrain layout",
            sketch_data_url: sketchDataUrl ?? undefined,
            has_strokes: hasStrokes,
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
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Scenery synthesis failed");
      }

      const meta = data.canvas_meta;
      if (meta) {
        canvasMetaRef.current = { ...canvasMetaRef.current, ...meta };
      }
      if (data.queued && meta?.scenery_preview_url === SCENERY_PENDING) {
        setSceneryPreviewUrl(SCENERY_PENDING);
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

      if (data.queued) {
        toastSuccess(
          data.used_sketch_reference
            ? (data.message ?? "Scenery queued from your map sketch")
            : (data.message ?? "Scenery generation queued (text only)"),
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
  }, [apiAvailable, synthesizing, projectId, lines, pins]);

  const toolbarTools = useMemo(() => {
    const base: CanvasTool[] = ["brush", "pan", "eraser"];
    if (hasSceneryImage) base.push("scenery");
    return base;
  }, [hasSceneryImage]);

  const toolbar = useMemo(
    () => (
      <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[95vw] -translate-x-1/2 flex-wrap justify-center gap-2 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e]/95 p-1 shadow-lg backdrop-blur">
        {toolbarTools.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTool(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
              tool === t
                ? "bg-[#7c3aed] text-white"
                : "text-[#9ca3af] hover:text-white",
            )}
          >
            {t}
          </button>
        ))}
        {apiAvailable ? (
          <button
            type="button"
            disabled={synthesizing}
            onClick={() => void handleSynthesizeScenery()}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium text-[#a78bfa] hover:bg-[#7c3aed]/20",
              synthesizing && "cursor-wait opacity-60",
            )}
          >
            {synthesizing ? "Synthesizing…" : "Synthesize scenery"}
          </button>
        ) : null}
      </div>
    ),
    [toolbarTools, tool, apiAvailable, synthesizing, handleSynthesizeScenery],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#0e0e0f]">
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
            Generating scenery preview…
          </span>
        </div>
      ) : null}
      {toolbar}
      {pins.length === 0 && !pinCreator && tool === "brush" ? (
        <p className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center text-sm text-[#9ca3af]">
          Click anywhere to add a location
        </p>
      ) : null}

      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        draggable={tool === "pan"}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onMousemove={handlePointerMove}
        onTouchMove={handlePointerMove}
        onMouseup={handlePointerUp}
        onTouchEnd={handlePointerUp}
        onClick={handleStageClick}
        onDragEnd={(e) => {
          if (tool === "pan") {
            const pos = { x: e.target.x(), y: e.target.y() };
            setStagePos(pos);
            persistCanvas();
          }
        }}
        className={toolCursor(tool)}
      >
        <Layer>
          {hasSceneryImage && sceneryTransform ? (
            <Group
              ref={sceneryGroupRef}
              x={sceneryTransform.x}
              y={sceneryTransform.y}
              scaleX={sceneryTransform.scaleX}
              scaleY={sceneryTransform.scaleY}
              draggable={tool === "scenery"}
              listening={tool === "scenery"}
              onDragEnd={handleSceneryDragEnd}
              onTransformEnd={handleSceneryTransformEnd}
            >
              <KonvaImage
                image={sceneryImage!}
                width={sceneryTransform.width}
                height={sceneryTransform.height}
                opacity={SCENERY_OPACITY}
              />
              {tool === "scenery" ? (
                <Rect
                  width={sceneryTransform.width}
                  height={sceneryTransform.height}
                  stroke="#7c3aed"
                  strokeWidth={2 / scale}
                  dash={[8 / scale, 4 / scale]}
                  listening={false}
                />
              ) : null}
            </Group>
          ) : null}
          {tool === "scenery" && hasSceneryImage ? (
            <Transformer
              ref={sceneryTransformerRef}
              rotateEnabled={false}
              borderStroke="#7c3aed"
              anchorStroke="#a78bfa"
              anchorFill="#1a1a1e"
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 32 || newBox.height < 32) return oldBox;
                return newBox;
              }}
            />
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
