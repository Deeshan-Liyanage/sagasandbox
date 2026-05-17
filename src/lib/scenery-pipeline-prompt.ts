import { projectStyleConfig } from "@/lib/fal";
import type { SceneryGeospatialContext } from "@/lib/scenery-prompt";
import type { SceneryLayoutPlan } from "@/lib/scenery-layout-plan";

export function buildBaseMapPrompt(
  project: {
    name?: string | null;
    theme?: string | null;
    aesthetic_style?: string | null;
    style_config?: unknown;
  },
  plan: SceneryLayoutPlan,
  geospatial: SceneryGeospatialContext,
  synthesisUserNotes?: string | null,
): string {
  const style = projectStyleConfig(project);
  const regions = plan.regions
    .map((r) => `- ${r.label} (${r.colorHint}): ${r.boundsHint}`)
    .join("\n");
  const paths =
    plan.paths.length > 0
      ? plan.paths.map((p) => `- ${p.label}: ${p.description ?? "connecting route"}`).join("\n")
      : "None specified";
  const landmarks = plan.landmarks
    .map((l, i) => {
      const pin = geospatial.pins[l.pinIndex];
      const label = pin?.label ?? `Pin ${i + 1}`;
      return `- Slot ${i + 1} at map position for "${label}": leave a clear focal area; ${l.visualDescription}`;
    })
    .join("\n");

  const userNotes = synthesisUserNotes?.trim();

  return [
    "ROLE: Expert cartographic environment artist for SagaSandbox.",
    `PROJECT: "${project.name ?? "Untitled"}" | theme ${style.theme} | aesthetic ${style.aesthetic_style} | tone ${style.tone ?? style.theme}.`,
    "TASK: Transform the attached wireframe structure reference into a polished 2D top-down orthographic story map.",
    "WIREFRAME GUIDE:",
    "- Colored blobs = terrain regions to render with distinct biomes/materials.",
    "- Dashed lines = rivers, roads, or trade routes.",
    "- Numbered amber circles = mandatory landmark slots (preserve exact positions; replace circles with finished art).",
    "REGIONS:",
    regions,
    "PATHS:",
    paths,
    "LANDMARK SLOTS (preserve positions; make each site visually obvious):",
    landmarks || "No pins — invent cohesive geography.",
    "STYLE:",
    plan.styleNotes || `Render in ${style.aesthetic_style} with ${style.tone} atmosphere. Vibrant, feature-rich cartography.`,
    "CONSTRAINTS:",
    "- No UI chrome, watermarks, scale bars, or readable place-name typography.",
    "- Edge-to-edge landscape map plate; numbered guide circles must become real landmarks.",
    userNotes ? `USER OVERRIDES: ${userNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildLandmarkPrompt(
  project: {
    theme?: string | null;
    aesthetic_style?: string | null;
    style_config?: unknown;
  },
  landmarkDescription: string,
  pinLabel: string,
): string {
  const style = projectStyleConfig(project);
  return [
    `Isolated landmark asset for a ${style.theme} story map.`,
    `Location: "${pinLabel}".`,
    landmarkDescription,
    `Style: ${style.aesthetic_style}, ${style.tone ?? style.theme}.`,
    "Single prominent structure or natural feature, top-down or slight aerial, high detail, no text, no map border, square composition on neutral dark ground.",
  ].join(" ");
}
