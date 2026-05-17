import type { SupabaseClient } from "@supabase/supabase-js";
import { extractCanvasMeta } from "@/lib/canvas-state";
import {
  buildScenerySynthesisPrompt,
  type SceneryGeospatialContext,
} from "@/lib/scenery-prompt";

export const MAX_SKETCH_DATA_URL_CHARS = 4 * 1024 * 1024;

export interface ScenerySynthesizeRequestBody {
  reference_image_url?: string;
  sketch_data_url?: string;
  has_strokes?: boolean;
  synthesis_user_notes?: string | null;
  geospatial?: SceneryGeospatialContext;
}

export interface ResolvedScenerySynthesis {
  project: {
    id: string;
    name?: string | null;
    theme?: string | null;
    aesthetic_style?: string | null;
    canvas_state?: unknown;
    [key: string]: unknown;
  };
  geospatial: SceneryGeospatialContext;
  synthesisUserNotes: string | null;
  hasSketchReference: boolean;
  prompt: string;
  warnings: string[];
}

export function validateScenerySynthesizeBody(
  body: ScenerySynthesizeRequestBody,
): { error: string; status: number } | null {
  const sketchLen = body.sketch_data_url?.length ?? 0;
  if (sketchLen > MAX_SKETCH_DATA_URL_CHARS) {
    return {
      error: "Map sketch exceeds maximum upload size (4MB)",
      status: 413,
    };
  }
  return null;
}

export async function resolveScenerySynthesis(
  supabase: SupabaseClient,
  projectId: string,
  body: ScenerySynthesizeRequestBody,
  options?: {
    referenceImageUrl?: string | null;
    sketchUploadFailed?: boolean;
    /** Preview: treat client sketch payload as img2img without uploading. */
    forPreview?: boolean;
  },
): Promise<
  | { ok: true; data: ResolvedScenerySynthesis }
  | { ok: false; error: string; status: number }
> {
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { ok: false, error: "Project not found", status: 404 };
  }

  const { data: pins } = await supabase
    .from("location_pins")
    .select("label, description, canvas_x, canvas_y")
    .eq("project_id", projectId);

  const dbPins = (pins ?? []).map((p) => ({
    label: p.label?.trim() || "Unnamed",
    description: p.description,
    canvas_x: p.canvas_x,
    canvas_y: p.canvas_y,
  }));

  const geospatial: SceneryGeospatialContext = body.geospatial
    ? {
        ...body.geospatial,
        pins: body.geospatial.pins?.length ? body.geospatial.pins : dbPins,
      }
    : {
        canvas_width: 800,
        canvas_height: 600,
        stroke_count: body.has_strokes ? 1 : 0,
        stroke_point_count: 0,
        stroke_bounds: null,
        pins: dbPins,
      };

  const existingMeta = extractCanvasMeta(
    project.canvas_state as Record<string, unknown> | null,
  );
  const synthesisUserNotes =
    body.synthesis_user_notes !== undefined
      ? body.synthesis_user_notes
      : (existingMeta.synthesis_user_notes ?? null);

  const clientSentSketch = Boolean(body.sketch_data_url?.trim());
  const referenceImageUrl =
    options?.referenceImageUrl !== undefined
      ? options.referenceImageUrl
      : (body.reference_image_url ?? null);

  const hasSketchReference = options?.sketchUploadFailed
    ? false
    : Boolean(referenceImageUrl) ||
      (Boolean(options?.forPreview) && clientSentSketch);

  const warnings: string[] = [];
  if (body.has_strokes === false) {
    warnings.push(
      "No brush strokes on the map — generating from theme and location pins only.",
    );
  }
  if (clientSentSketch && options?.sketchUploadFailed) {
    warnings.push(
      "Could not upload the map sketch; generating from text only.",
    );
  }

  const prompt = buildScenerySynthesisPrompt({
    project,
    hasSketchReference,
    geospatial,
    synthesis_user_notes: synthesisUserNotes,
  });

  return {
    ok: true,
    data: {
      project,
      geospatial,
      synthesisUserNotes,
      hasSketchReference,
      prompt,
      warnings,
    },
  };
}
