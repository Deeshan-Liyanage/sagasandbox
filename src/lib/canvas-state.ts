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

type KonvaNode = {
  className?: string;
  attrs?: Record<string, unknown>;
  children?: KonvaNode[];
};

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
  if (!raw || typeof raw !== "object") return null;
  if (Object.keys(raw).length === 0) return null;

  const root = raw as KonvaNode;
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
