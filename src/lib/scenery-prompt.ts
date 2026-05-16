import { buildPrompt, projectStyleConfig } from "@/lib/fal";

type ProjectStyleSource = Parameters<typeof projectStyleConfig>[0];

export function buildScenerySynthesisPrompt(options: {
  project: ProjectStyleSource;
  pinLabels: string[];
  hasSketchReference: boolean;
  extraDescription?: string;
}): string {
  const styleConfig = projectStyleConfig(options.project);
  const chunks: string[] = [];

  if (options.hasSketchReference) {
    chunks.push(
      "Transform the user's hand-drawn geography map sketch into a high-fidelity cinematic environment backdrop. Preserve the spatial layout, regions, paths, coastlines, and boundaries implied by the brush strokes and markers in the reference image.",
    );
  } else {
    chunks.push(
      "Generate a cinematic environment backdrop for a geography story map. No hand-drawn sketch was provided.",
    );
  }

  if (options.pinLabels.length > 0) {
    chunks.push(
      `Named locations on the map: ${options.pinLabels.join(", ")}.`,
    );
  }

  if (options.extraDescription?.trim()) {
    chunks.push(options.extraDescription.trim());
  }

  return buildPrompt({
    styleConfig,
    description: chunks.join(" "),
  });
}
