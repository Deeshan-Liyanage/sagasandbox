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
import { Stage, Layer, Line, Circle, Text, Group } from "react-konva";
import type Konva from "konva";
import type { LocationPin } from "@/types/app";
import { GEN_STATUS_COLORS } from "@/lib/constants";
import {
  broadcastCanvasOp,
  type CanvasOpPayload,
} from "@/hooks/useRealtime";
import { cn } from "@/lib/cn";
import { PinCreator } from "./PinCreator";

export type CanvasTool = "brush" | "pan";

export interface GeographyCanvasProps {
  projectId: string;
  pins: LocationPin[];
  onPinsChange: Dispatch<SetStateAction<LocationPin[]>>;
  onPinSelect: (pin: LocationPin) => void;
  onCanvasChange: (konvaJson: object) => void;
  loading?: boolean;
  userId?: string;
  apiAvailable?: boolean;
}

export interface GeographyCanvasHandle {
  applyCanvasOp: (op: CanvasOpPayload) => void;
}

interface BrushLine {
  id: string;
  points: number[];
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

function pinColor(status: LocationPin["gen_status"]) {
  return GEN_STATUS_COLORS[status] ?? "#F59E0B";
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
    loading = false,
    userId = "local",
    apiAvailable = true,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [tool, setTool] = useState<CanvasTool>("brush");
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [lines, setLines] = useState<BrushLine[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [pinCreator, setPinCreator] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const applyCanvasOp = useCallback(
    (op: CanvasOpPayload) => {
      if (op.user_id === userId) return;

      const points = op.payload.points;
      if (!Array.isArray(points) || points.some((n) => typeof n !== "number")) {
        return;
      }

      switch (op.op) {
        case "add":
        case "modify":
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
        case "delete":
          setLines((prev) => prev.filter((l) => l.id !== op.object_id));
          break;
        case "cursor":
          break;
        default:
          break;
      }
    },
    [userId],
  );

  useImperativeHandle(ref, () => ({ applyCanvasOp }), [applyCanvasOp]);

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

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
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

    setScale(newScale);
    setStagePos(newPos);
  }, []);

  const getStagePoint = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pos);
  }, []);

  const persistCanvas = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    onCanvasChange(JSON.parse(stage.toJSON()) as object);
  }, [onCanvasChange]);

  const handlePointerDown = useCallback(() => {
    if (tool === "pan") return;
    const point = getStagePoint();
    if (!point) return;

    if (tool === "brush") {
      const id = crypto.randomUUID();
      setCurrentLineId(id);
      setDrawing(true);
      setLines((prev) => [...prev, { id, points: [point.x, point.y] }]);
    }
  }, [tool, getStagePoint]);

  const handlePointerMove = useCallback(() => {
    if (!drawing || !currentLineId) return;
    const point = getStagePoint();
    if (!point) return;

    setLines((prev) =>
      prev.map((line) =>
        line.id === currentLineId
          ? { ...line, points: [...line.points, point.x, point.y] }
          : line,
      ),
    );
  }, [drawing, currentLineId, getStagePoint]);

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
    setDrawing(false);
    setCurrentLineId(null);
  }, [
    drawing,
    currentLineId,
    lines,
    projectId,
    userId,
    persistCanvas,
  ]);

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

  const toolbar = useMemo(
    () => (
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e]/95 p-1 shadow-lg backdrop-blur">
        {(["brush", "pan"] as CanvasTool[]).map((t) => (
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
      </div>
    ),
    [tool],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0e0e0f]">
        <div className="h-48 w-full max-w-md animate-pulse rounded-lg bg-[#1a1a1e]" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-[#0e0e0f]">
      {toolbar}
      {pins.length === 0 && !pinCreator ? (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#9ca3af]">
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
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        className="cursor-crosshair"
      >
        <Layer>
          {lines.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke="#7c3aed"
              strokeWidth={3 / scale}
              tension={0.4}
              lineCap="round"
              lineJoin="round"
            />
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
                stroke="#0e0e0f"
                strokeWidth={2}
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
