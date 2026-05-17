import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { projectStyleConfig } from "@/lib/fal";
import type { SceneryGeospatialContext } from "@/lib/scenery-prompt";

const regionSchema = z.object({
  id: z.string(),
  label: z.string(),
  colorHint: z.string(),
  boundsHint: z.string(),
});

const landmarkSchema = z.object({
  pinIndex: z.number().int().nonnegative(),
  featureType: z.string(),
  visualDescription: z.string(),
  prominence: z.enum(["low", "medium", "high"]).default("high"),
});

const pathSchema = z.object({
  id: z.string(),
  label: z.string(),
  fromRegionId: z.string().optional(),
  toRegionId: z.string().optional(),
  description: z.string().optional(),
});

export const sceneryLayoutPlanSchema = z.object({
  regions: z.array(regionSchema).min(1),
  landmarks: z.array(landmarkSchema),
  paths: z.array(pathSchema).default([]),
  styleNotes: z.string().default(""),
});

export type SceneryLayoutPlan = z.infer<typeof sceneryLayoutPlanSchema>;
export type SceneryLayoutRegion = z.infer<typeof regionSchema>;
export type SceneryLayoutLandmark = z.infer<typeof landmarkSchema>;

const REGION_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ec4899",
  "#14b8a6",
];

export interface LayoutPlanInput {
  project: {
    name?: string | null;
    theme?: string | null;
    aesthetic_style?: string | null;
    style_config?: unknown;
  };
  geospatial: SceneryGeospatialContext;
  synthesis_user_notes?: string | null;
}

function quadrantLabel(x: number, y: number, w: number, h: number): string {
  const hx = x < w / 2 ? "west" : "east";
  const vy = y < h / 2 ? "north" : "south";
  return `${vy}-${hx}`;
}

/** Deterministic layout when OpenAI is unavailable. */
export function buildHeuristicLayoutPlan(
  input: LayoutPlanInput,
): SceneryLayoutPlan {
  const { geospatial } = input;
  const style = projectStyleConfig(input.project);
  const pins = geospatial.pins;
  const w = geospatial.canvas_width || 800;
  const h = geospatial.canvas_height || 600;

  const regions: SceneryLayoutRegion[] = [];
  if (pins.length <= 1) {
    regions.push({
      id: "core",
      label: "Central territory",
      colorHint: REGION_COLORS[0],
      boundsHint: "center mass of the map plate",
    });
  } else if (pins.length <= 3) {
    regions.push({
      id: "primary",
      label: "Primary locale",
      colorHint: REGION_COLORS[0],
      boundsHint: "cluster around main pins",
    });
    regions.push({
      id: "outer",
      label: "Surrounding lands",
      colorHint: REGION_COLORS[1],
      boundsHint: "fill between and beyond pin cluster",
    });
  } else {
    const quadrants = new Map<string, typeof pins>();
    for (const pin of pins) {
      const key = quadrantLabel(pin.canvas_x, pin.canvas_y, w, h);
      const list = quadrants.get(key) ?? [];
      list.push(pin);
      quadrants.set(key, list);
    }
    let i = 0;
    for (const [quad, quadPins] of quadrants) {
      regions.push({
        id: `region-${quad}`,
        label: `${quad.replace("-", " ")} district`,
        colorHint: REGION_COLORS[i % REGION_COLORS.length],
        boundsHint: `covers ${quadPins.length} pin(s) in the ${quad} quadrant`,
      });
      i += 1;
    }
    if (regions.length === 0) {
      regions.push({
        id: "world",
        label: "Story map",
        colorHint: REGION_COLORS[0],
        boundsHint: "full canvas",
      });
    }
  }

  const landmarks: SceneryLayoutLandmark[] = pins.map((pin, pinIndex) => {
    const desc = pin.description?.trim();
    return {
      pinIndex,
      featureType: "landmark",
      visualDescription: desc
        ? `${pin.label}: ${desc}. Large, unmistakable built landmark or natural feature.`
        : `${pin.label}: prominent, clearly readable landmark structure or district centerpiece.`,
      prominence: "high" as const,
    };
  });

  const paths =
    pins.length >= 2
      ? [
          {
            id: "route-main",
            label: "Connecting route",
            description:
              "Primary path linking named locations; follow pin layout left-to-right or radially.",
          },
        ]
      : [];

  return {
    regions,
    landmarks,
    paths,
    styleNotes: `Theme ${style.theme}, aesthetic ${style.aesthetic_style}. ${input.synthesis_user_notes?.trim() ?? "Vibrant cartographic detail."}`,
  };
}

function createLayoutPlannerModel() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  const provider = createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
  return provider("gpt-4o-mini");
}

export async function generateSceneryLayoutPlan(
  input: LayoutPlanInput,
): Promise<{ plan: SceneryLayoutPlan; source: "llm" | "heuristic" }> {
  const model = createLayoutPlannerModel();
  if (!model) {
    return { plan: buildHeuristicLayoutPlan(input), source: "heuristic" };
  }

  const style = projectStyleConfig(input.project);
  const pinsJson = input.geospatial.pins.map((p, i) => ({
    index: i,
    label: p.label,
    description: p.description,
    x: Math.round(p.canvas_x),
    y: Math.round(p.canvas_y),
  }));

  try {
    const { object } = await generateObject({
      model,
      schema: sceneryLayoutPlanSchema,
      prompt: `You are a cartography layout planner for SagaSandbox.
Produce a JSON layout plan for a 2D top-down story map.

Project: ${input.project.name ?? "Untitled"}
Theme: ${style.theme}
Aesthetic: ${style.aesthetic_style}
Canvas: ${input.geospatial.canvas_width}x${input.geospatial.canvas_height}
Strokes: ${input.geospatial.stroke_count} paths, ${input.geospatial.stroke_point_count} points
Stroke bounds: ${JSON.stringify(input.geospatial.stroke_bounds)}
Pins: ${JSON.stringify(pinsJson, null, 2)}
User notes: ${input.synthesis_user_notes?.trim() || "none"}

Rules:
- regions: 1-6 colored zones with boundsHint describing where on the map (use quadrants / relative position, not pixel-perfect boxes)
- landmarks: one entry per pin index (0-based pinIndex); visualDescription must be vivid and specify a large obvious feature
- paths: optional rivers/roads between regions
- styleNotes: one paragraph for the image model
- Do NOT include readable place-name typography in the artwork; landmarks are visual only`,
    });

    const parsed = sceneryLayoutPlanSchema.safeParse(object);
    if (!parsed.success) {
      return { plan: buildHeuristicLayoutPlan(input), source: "heuristic" };
    }

    const pinCount = input.geospatial.pins.length;
    const landmarks =
      parsed.data.landmarks.length >= pinCount
        ? parsed.data.landmarks
        : [
            ...parsed.data.landmarks,
            ...buildHeuristicLayoutPlan(input).landmarks.slice(
              parsed.data.landmarks.length,
            ),
          ];

    return {
      plan: { ...parsed.data, landmarks: landmarks.slice(0, pinCount) },
      source: "llm",
    };
  } catch (err) {
    console.warn("[scenery] layout plan LLM failed:", err);
    return { plan: buildHeuristicLayoutPlan(input), source: "heuristic" };
  }
}
