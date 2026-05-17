export const SCENERY_PIPELINE_VERSION = 2;

export type SceneryPipelineStage =
  | "planning"
  | "wireframe"
  | "base"
  | "pins"
  | "harmonize"
  | "complete"
  | "error";

export function pipelineStageLabel(
  stage: SceneryPipelineStage | null | undefined,
): string {
  switch (stage) {
    case "planning":
      return "Planning layout…";
    case "wireframe":
      return "Rendering wireframe…";
    case "base":
      return "Generating base map…";
    case "pins":
      return "Placing landmarks…";
    case "harmonize":
      return "Harmonizing lighting…";
    case "complete":
      return "Scenery complete";
    case "error":
      return "Scenery generation failed";
    default:
      return "Generating scenery preview…";
  }
}
