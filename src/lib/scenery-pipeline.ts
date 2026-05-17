import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractCanvasMeta,
  patchCanvasMeta,
  type CanvasMeta,
} from "@/lib/canvas-state";
import { uploadCanvasSketchDataUrl } from "@/lib/canvas-sketch-upload";
import {
  falGenerateSync,
  falQueue,
  FLUX_TEXT_MODEL,
  projectStyleConfig,
  SCENERY_FLUX_IMG2IMG_MODEL,
  SCENERY_FLUX_TEXT_MODEL,
} from "@/lib/fal";
import {
  compositeLandmarksOntoBase,
  fetchImageBuffer,
} from "@/lib/scenery-composite";
import {
  generateSceneryLayoutPlan,
  type SceneryLayoutPlan,
} from "@/lib/scenery-layout-plan";
import {
  buildBaseMapPrompt,
  buildLandmarkPrompt,
} from "@/lib/scenery-pipeline-prompt";
import type { SceneryGeospatialContext } from "@/lib/scenery-prompt";
import { renderWireframeDataUrl, renderWireframePng } from "@/lib/scenery-wireframe";
import {
  getFalImageUrl,
  SCENERY_ERROR,
  SCENERY_PENDING,
  uploadGeneratedImage,
  updateProjectSceneryMeta,
} from "@/lib/scenery-synthesis";
import "server-only";

import { fal } from "@fal-ai/client";
import type { Database, Json } from "@/types/db";
import { SCENERY_PIPELINE_VERSION } from "@/lib/scenery-pipeline-types";

export { SCENERY_PIPELINE_VERSION, pipelineStageLabel } from "@/lib/scenery-pipeline-types";
export type { SceneryPipelineStage } from "@/lib/scenery-pipeline-types";

export const SCENERY_BASE_IMAGE_STRENGTH = 0.62;

export interface TierBPipelineStartInput {
  project: {
    id: string;
    name?: string | null;
    theme?: string | null;
    aesthetic_style?: string | null;
    style_config?: unknown;
    canvas_state?: unknown;
  };
  geospatial: SceneryGeospatialContext;
  synthesisUserNotes: string | null;
  promptOverride?: string;
}

export interface TierBPipelineStartResult {
  queued: boolean;
  message: string;
  canvasState: Record<string, unknown>;
  layoutPlan: SceneryLayoutPlan;
  layoutPlanSource: "llm" | "heuristic";
  wireframeUrl: string | null;
  requestId: string | null;
  /** Local dev: full pipeline may finish inline. */
  completedInline: boolean;
}

async function uploadWireframeBuffer(
  supabase: SupabaseClient<Database>,
  projectId: string,
  png: Buffer,
): Promise<string | null> {
  const path = `canvas/${projectId}/wireframe-${Date.now()}.png`;
  const { error } = await supabase.storage.from("images").upload(path, png, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) {
    console.warn("Wireframe upload failed:", error.message);
    return null;
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("images").getPublicUrl(path);
  return publicUrl;
}

async function uploadFinalBuffer(
  supabase: SupabaseClient<Database>,
  projectId: string,
  jpeg: Buffer,
  suffix: string,
): Promise<string | null> {
  const path = `canvas/${projectId}/scenery-${suffix}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("images").upload(path, jpeg, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) {
    console.warn("Scenery final upload failed:", error.message);
    return null;
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("images").getPublicUrl(path);
  return publicUrl;
}

/** Steps 3–4: per-pin Fal tiles + composite onto base map. */
export async function runPinCompositeStage(
  supabase: SupabaseClient<Database>,
  projectId: string,
  canvasState: Record<string, unknown> | null | undefined,
  options: {
    project: TierBPipelineStartInput["project"];
    geospatial: SceneryGeospatialContext;
    layoutPlan: SceneryLayoutPlan;
    baseImageUrl: string;
  },
): Promise<CanvasMeta> {
  const baseBuffer = await fetchImageBuffer(options.baseImageUrl);
  if (!baseBuffer) {
    return updateProjectSceneryMeta(supabase, projectId, canvasState, {
      scenery_preview_url: SCENERY_ERROR,
      scenery_pipeline_stage: "error",
      scenery_fal_request_id: null,
    });
  }

  const landmarkBuffers: { pinIndex: number; imageBuffer: Buffer }[] = [];

  for (const landmark of options.layoutPlan.landmarks) {
    const pin = options.geospatial.pins[landmark.pinIndex];
    if (!pin) continue;

    const prompt = buildLandmarkPrompt(
      options.project,
      landmark.visualDescription,
      pin.label,
    );

    const imageUrl = await falGenerateSync({
      prompt,
      model: FLUX_TEXT_MODEL,
      width: 512,
      height: 512,
    });

    if (!imageUrl) continue;
    const buf = await fetchImageBuffer(imageUrl);
    if (buf) landmarkBuffers.push({ pinIndex: landmark.pinIndex, imageBuffer: buf });
  }

  const compositeJpeg = await compositeLandmarksOntoBase(
    baseBuffer,
    options.geospatial,
    landmarkBuffers,
  );

  let finalJpeg = compositeJpeg;
  let workingCanvasState = canvasState;
  const harmonizeEnabled =
    process.env.SCENERY_ENABLE_HARMONIZE === "true" &&
    Boolean(process.env.FAL_KEY?.trim());

  if (harmonizeEnabled) {
    await updateProjectSceneryMeta(supabase, projectId, workingCanvasState, {
      scenery_pipeline_stage: "harmonize",
    });
    workingCanvasState = patchCanvasMeta(workingCanvasState, {
      scenery_pipeline_stage: "harmonize",
    });

    const preUrl = await uploadFinalBuffer(
      supabase,
      projectId,
      compositeJpeg,
      "pre-harmonize",
    );
    if (preUrl) {
      const style = projectStyleConfig(options.project);
      const harmonizePrompt = [
        "Unify lighting, shadows, and color grading across this entire story map.",
        "Keep geography and landmark placements unchanged; seamless blending.",
        `${style.aesthetic_style} look, ${style.theme} tone.`,
        "No typography or readable labels.",
      ].join(" ");

      const harmonizedUrl = await falGenerateSync({
        prompt: harmonizePrompt,
        model: SCENERY_FLUX_IMG2IMG_MODEL,
        imageUrl: preUrl,
        width: 1280,
        height: 720,
        strength: 0.38,
      });
      const harmonizedBuf = harmonizedUrl
        ? await fetchImageBuffer(harmonizedUrl)
        : null;
      if (harmonizedBuf) {
        finalJpeg = harmonizedBuf;
      }
    }
  }

  const finalUrl = await uploadFinalBuffer(
    supabase,
    projectId,
    finalJpeg,
    "final",
  );

  if (!finalUrl) {
    return updateProjectSceneryMeta(supabase, projectId, canvasState, {
      scenery_preview_url: SCENERY_ERROR,
      scenery_pipeline_stage: "error",
      scenery_fal_request_id: null,
    });
  }

  return updateProjectSceneryMeta(supabase, projectId, canvasState, {
    scenery_preview_url: finalUrl,
    scenery_pipeline_stage: "complete",
    scenery_fal_request_id: null,
    scenery_base_map_url: options.baseImageUrl,
  });
}

/** After base Fal job completes: persist base URL and run pin composite (poll / local path). */
export async function continuePipelineAfterBase(
  supabase: SupabaseClient<Database>,
  projectId: string,
  canvasState: Record<string, unknown> | null | undefined,
  baseImageUrl: string,
): Promise<CanvasMeta> {
  const meta = extractCanvasMeta(canvasState);
  const layoutPlan = meta.scenery_layout_plan;
  if (!layoutPlan) {
    return updateProjectSceneryMeta(supabase, projectId, canvasState, {
      scenery_preview_url: baseImageUrl,
      scenery_pipeline_stage: "complete",
      scenery_fal_request_id: null,
    });
  }

  const geospatial = meta.scenery_pipeline_geospatial;
  if (!geospatial) {
    return updateProjectSceneryMeta(supabase, projectId, canvasState, {
      scenery_preview_url: baseImageUrl,
      scenery_pipeline_stage: "complete",
      scenery_fal_request_id: null,
      scenery_base_map_url: baseImageUrl,
    });
  }

  const interim = await updateProjectSceneryMeta(supabase, projectId, canvasState, {
    scenery_pipeline_stage: "pins",
    scenery_base_map_url: baseImageUrl,
    scenery_fal_request_id: null,
  });

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, theme, aesthetic_style, style_config, canvas_state")
    .eq("id", projectId)
    .single();

  if (!project) {
    return interim;
  }

  return runPinCompositeStage(supabase, projectId, project.canvas_state as Record<string, unknown>, {
    project,
    geospatial,
    layoutPlan,
    baseImageUrl,
  });
}

/** Steps 0–2: layout plan, wireframe upload, queue base map img2img. */
export async function startTierBPipeline(
  supabase: SupabaseClient<Database>,
  input: TierBPipelineStartInput,
): Promise<TierBPipelineStartResult> {
  const { project, geospatial, synthesisUserNotes } = input;
  const projectId = project.id;
  let canvasState = patchCanvasMeta(
    project.canvas_state as Record<string, unknown> | null,
    {
      scenery_preview_url: SCENERY_PENDING,
      scenery_pipeline_version: SCENERY_PIPELINE_VERSION,
      scenery_pipeline_stage: "planning",
      scenery_fal_request_id: null,
      last_synthesis_at: new Date().toISOString(),
      synthesis_user_notes: synthesisUserNotes,
      scenery_pipeline_geospatial: geospatial,
    },
  );

  await supabase
    .from("projects")
    .update({ canvas_state: canvasState as Json })
    .eq("id", projectId);

  const { plan: layoutPlan, source: layoutPlanSource } =
    await generateSceneryLayoutPlan({
      project,
      geospatial,
      synthesis_user_notes: synthesisUserNotes,
    });

  canvasState = patchCanvasMeta(canvasState, {
    scenery_pipeline_stage: "wireframe",
    scenery_layout_plan: layoutPlan,
    scenery_layout_plan_source: layoutPlanSource,
  });
  await supabase
    .from("projects")
    .update({ canvas_state: canvasState as Json })
    .eq("id", projectId);

  const wireframePng = await renderWireframePng(layoutPlan, geospatial);
  let wireframeUrl = await uploadWireframeBuffer(supabase, projectId, wireframePng);
  if (!wireframeUrl) {
    const dataUrl = await renderWireframeDataUrl(layoutPlan, geospatial);
    wireframeUrl = await uploadCanvasSketchDataUrl(supabase, projectId, dataUrl);
  }

  const builtBasePrompt = buildBaseMapPrompt(
    project,
    layoutPlan,
    geospatial,
    synthesisUserNotes,
  );
  const basePrompt = input.promptOverride?.trim() || builtBasePrompt;

  canvasState = patchCanvasMeta(canvasState, {
    scenery_pipeline_stage: "base",
    scenery_wireframe_url: wireframeUrl,
    scenery_base_prompt: basePrompt,
  });
  await supabase
    .from("projects")
    .update({ canvas_state: canvasState as Json })
    .eq("id", projectId);

  if (!process.env.FAL_KEY) {
    canvasState = patchCanvasMeta(canvasState, {
      scenery_preview_url: null,
      scenery_pipeline_stage: "error",
    });
    await supabase
      .from("projects")
      .update({ canvas_state: canvasState as Json })
      .eq("id", projectId);
    return {
      queued: false,
      message: "FAL_KEY not configured",
      canvasState,
      layoutPlan,
      layoutPlanSource,
      wireframeUrl,
      requestId: null,
      completedInline: false,
    };
  }

  const falModel = wireframeUrl
    ? SCENERY_FLUX_IMG2IMG_MODEL
    : SCENERY_FLUX_TEXT_MODEL;

  const result = await falQueue({
    prompt: basePrompt,
    model: falModel,
    imageUrl: wireframeUrl ?? undefined,
    width: 1280,
    height: 720,
    strength: wireframeUrl ? SCENERY_BASE_IMAGE_STRENGTH : undefined,
  });

  const requestIds = result?.requestId ? [result.requestId] : [];

  if (result?.imageUrl) {
    const baseStorage = await uploadGeneratedImage(
      supabase,
      result.requestId,
      result.imageUrl,
    );
    const baseUrl = baseStorage ?? result.imageUrl;
    const finalMeta = await continuePipelineAfterBase(
      supabase,
      projectId,
      canvasState,
      baseUrl,
    );
    const nextState = patchCanvasMeta(canvasState, {
      scenery_preview_url: finalMeta.scenery_preview_url,
      scenery_pipeline_stage: finalMeta.scenery_pipeline_stage,
      scenery_base_map_url: finalMeta.scenery_base_map_url,
      scenery_fal_request_id: null,
      scenery_pipeline_request_ids: requestIds,
    });
    await supabase
      .from("projects")
      .update({ canvas_state: nextState as Json })
      .eq("id", projectId);

    return {
      queued: false,
      message: "Scenery synthesis complete (Tier B pipeline)",
      canvasState: nextState,
      layoutPlan,
      layoutPlanSource,
      wireframeUrl,
      requestId: null,
      completedInline: true,
    };
  }

  canvasState = patchCanvasMeta(canvasState, {
    scenery_preview_url: result ? SCENERY_PENDING : null,
    scenery_fal_request_id: result?.requestId ?? null,
    scenery_fal_model: result ? falModel : null,
    scenery_pipeline_request_ids: requestIds,
  });
  await supabase
    .from("projects")
    .update({ canvas_state: canvasState as Json })
    .eq("id", projectId);

  return {
    queued: Boolean(result),
    message: result
      ? "Tier B scenery pipeline queued (base map)"
      : "Failed to queue scenery generation",
    canvasState,
    layoutPlan,
    layoutPlanSource,
    wireframeUrl,
    requestId: result?.requestId ?? null,
    completedInline: false,
  };
}

/** Resolve Fal queue result URL for a completed base job. */
export async function fetchFalResultImageUrl(
  model: string,
  requestId: string,
): Promise<string | null> {
  try {
    const result = await fal.queue.result(model, { requestId });
    return getFalImageUrl(result.data);
  } catch {
    return null;
  }
}
