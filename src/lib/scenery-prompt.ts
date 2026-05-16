import { projectStyleConfig } from "@/lib/fal";

type ProjectStyleSource = Parameters<typeof projectStyleConfig>[0] & {
  name?: string;
};

export interface SceneryPinGeo {
  label: string;
  description?: string | null;
  canvas_x: number;
  canvas_y: number;
}

export interface SceneryStrokeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SceneryGeospatialContext {
  canvas_width: number;
  canvas_height: number;
  stroke_count: number;
  stroke_point_count: number;
  stroke_bounds: SceneryStrokeBounds | null;
  pins: SceneryPinGeo[];
}

export interface BuildSceneryPromptOptions {
  project: ProjectStyleSource;
  hasSketchReference: boolean;
  geospatial: SceneryGeospatialContext;
  synthesis_user_notes?: string | null;
}

function formatThemeLabel(theme: string): string {
  return theme.replace(/_/g, " ");
}

function formatPinList(pins: SceneryPinGeo[]): string {
  if (pins.length === 0) {
    return "No named location pins on the canvas yet.";
  }
  return pins
    .map((pin, index) => {
      const parts = [
        `${index + 1}. "${pin.label.trim() || "Unnamed"}" at canvas coordinates (${Math.round(pin.canvas_x)}, ${Math.round(pin.canvas_y)})`,
      ];
      const desc = pin.description?.trim();
      if (desc) parts.push(`— ${desc}`);
      return parts.join(" ");
    })
    .join("\n");
}

function formatStrokeBounds(bounds: SceneryStrokeBounds | null): string {
  if (!bounds) return "No brush strokes recorded.";
  const w = Math.round(bounds.maxX - bounds.minX);
  const h = Math.round(bounds.maxY - bounds.minY);
  return `Sketch extent spans roughly ${w}×${h} units, from (${Math.round(bounds.minX)}, ${Math.round(bounds.minY)}) to (${Math.round(bounds.maxX)}, ${Math.round(bounds.maxY)}). Strokes imply regions, paths, coastlines, walls, or territorial boundaries the final map must honor.`;
}

function inferRegionsFromPins(pins: SceneryPinGeo[]): string {
  if (pins.length === 0) return "No pin clusters to infer.";
  if (pins.length === 1) return "Single landmark region.";
  const xs = pins.map((p) => p.canvas_x);
  const ys = pins.map((p) => p.canvas_y);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  if (spreadX < 80 && spreadY < 80) {
    return `${pins.length} pins cluster in a compact area — treat as one primary locale with sub-landmarks.`;
  }
  if (spreadX > spreadY * 1.5) {
    return `${pins.length} pins spread horizontally — suggest east–west regions or a linear journey map.`;
  }
  if (spreadY > spreadX * 1.5) {
    return `${pins.length} pins spread vertically — suggest north–south regions or elevation tiers.`;
  }
  return `${pins.length} pins distributed across the canvas — compose distinct quadrants or biomes around each marker.`;
}

/** Structured Flux prompt for geography / scenery synthesis. */
export function buildScenerySynthesisPrompt(
  options: BuildSceneryPromptOptions,
): string {
  const style = projectStyleConfig(options.project);
  const { geospatial, hasSketchReference } = options;
  const userNotes = options.synthesis_user_notes?.trim();
  const projectName = options.project.name?.trim() || "Untitled project";
  const themeLabel = formatThemeLabel(style.theme ?? "unspecified");
  const aesthetic = style.aesthetic_style ?? style.aesthetic ?? "cinematic";
  const tone = style.tone ?? themeLabel;

  const sections: string[] = [];

  sections.push(
    "ROLE: You are an expert cartographic environment artist for SagaSandbox, a collaborative narrative world-building workspace. You translate sparse geography sketches and location metadata into a polished, story-ready map backdrop.",
  );

  sections.push(
    [
      "PROJECT CONTEXT:",
      `- Universe: "${projectName}"`,
      `- Narrative theme: ${themeLabel}`,
      `- Global aesthetic: ${aesthetic}`,
      `- Mood / tone: ${tone}`,
      "- Setting: collaborative fiction or forensic reconstruction map used to anchor timeline events and character movement.",
    ].join("\n"),
  );

  sections.push(
    [
      "GEOSPATIAL DATA:",
      `- Canvas stage: ${Math.round(geospatial.canvas_width)}×${Math.round(geospatial.canvas_height)} coordinate units (origin top-left).`,
      `- Location pins (${geospatial.pins.length}):`,
      formatPinList(geospatial.pins),
      `- Pin layout inference: ${inferRegionsFromPins(geospatial.pins)}`,
      `- Brush strokes: ${geospatial.stroke_count} path(s), ${geospatial.stroke_point_count} vertex point(s).`,
      formatStrokeBounds(geospatial.stroke_bounds),
      hasSketchReference
        ? "- Reference: a hand-drawn map sketch image is attached via img2img — preserve its spatial layout, region shapes, paths, and marker positions."
        : "- Reference: no sketch image — infer geography from pins, theme, and stroke metadata only.",
    ].join("\n"),
  );

  sections.push(
    [
      "OUTPUT GOAL:",
      "- Primary deliverable: a flat 2D top-down cartographic map view (bird's-eye, orthographic), readable as a story geography board.",
      "- Depict terrain, districts, routes, water, structures, and zones implied by strokes and pins — not a 3D perspective scene unless USER OVERRIDES request otherwise.",
      "- The image fills the frame as a cohesive map plate suitable for overlaying interactive pins in the workspace.",
      hasSketchReference
        ? "- Align coastlines, borders, rivers, and regions with the attached sketch composition."
        : "- Compose a plausible map layout that connects all named locations meaningfully.",
    ].join("\n"),
  );

  sections.push(
    [
      "STYLE:",
      `- Render in ${aesthetic} technique with ${tone} atmosphere.`,
      `- Lighting: cinematic but map-legible — avoid extreme darkness that hides geography.`,
      `- Palette: harmonious with a ${themeLabel} world; restrained UI-neutral tones at edges.`,
      "- Line work: clear region boundaries; subtle contour or ink where appropriate for the aesthetic.",
      "- Mood: immersive, professional storyboard quality — the map is the hero asset, not interface chrome.",
    ].join("\n"),
  );

  sections.push(
    [
      "USER OVERRIDES:",
      userNotes
        ? userNotes
        : "None — follow default flat 2D top-down cartographic output.",
    ].join("\n"),
  );

  sections.push(
    [
      "CONSTRAINTS:",
      "- No application UI, toolbars, buttons, cursors, or watermark text.",
      "- Do not render pin labels as readable typography in the artwork unless USER OVERRIDES explicitly ask for labels.",
      "- No modern map UI elements (scale bars, compasses) unless requested.",
      "- Keep composition landscape-oriented and edge-to-edge.",
      hasSketchReference
        ? "- Img2img: treat violet brush strokes and amber pin markers in the reference as layout guides only — replace them with finished terrain art."
        : "- Text-only: invent coherent geography that respects pin coordinates as relative positions on the plate.",
    ].join("\n"),
  );

  return sections.join("\n\n");
}

export const buildSceneryPrompt = buildScenerySynthesisPrompt;
