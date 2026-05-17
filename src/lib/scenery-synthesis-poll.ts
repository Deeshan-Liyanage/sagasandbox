import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fal } from "@fal-ai/client";
import {
  extractCanvasMeta,
  type CanvasMeta,
} from "@/lib/canvas-state";
import {
  SCENERY_FLUX_IMG2IMG_MODEL,
  SCENERY_FLUX_TEXT_MODEL,
} from "@/lib/fal";
import {
  continuePipelineAfterBase,
  fetchFalResultImageUrl,
  runPinCompositeStage,
} from "@/lib/scenery-pipeline";
import { SCENERY_PIPELINE_VERSION } from "@/lib/scenery-pipeline-types";
import type { Database } from "@/types/db";
import {
  getFalImageUrl,
  isSceneryPreviewResolved,
  isScenerySynthesisStale,
  SCENERY_ERROR,
  SCENERY_PENDING,
  updateProjectSceneryMeta,
  uploadGeneratedImage,
} from "@/lib/scenery-synthesis";

function isTierBPipeline(meta: CanvasMeta): boolean {
  return meta.scenery_pipeline_version === SCENERY_PIPELINE_VERSION;
}

async function pollSceneryPipeline(
  supabase: SupabaseClient<Database>,
  projectId: string,
  canvasState: Record<string, unknown> | null | undefined,
  meta: CanvasMeta,
): Promise<{
  status: "idle" | "pending" | "complete" | "error";
  canvas_meta: CanvasMeta;
} | null> {
  if (!isTierBPipeline(meta)) return null;

  if (
    (meta.scenery_pipeline_stage === "pins" ||
      meta.scenery_pipeline_stage === "harmonize") &&
    meta.scenery_base_map_url
  ) {
    const layoutPlan = meta.scenery_layout_plan;
    const geospatial = meta.scenery_pipeline_geospatial;
    if (layoutPlan && geospatial) {
      const { data: project } = await supabase
        .from("projects")
        .select("id, name, theme, aesthetic_style, style_config, canvas_state")
        .eq("id", projectId)
        .single();

      if (project) {
        const canvas_meta = await runPinCompositeStage(
          supabase,
          projectId,
          project.canvas_state as Record<string, unknown>,
          {
            project,
            geospatial,
            layoutPlan,
            baseImageUrl: meta.scenery_base_map_url,
          },
        );
        const status = isSceneryPreviewResolved(canvas_meta.scenery_preview_url)
          ? "complete"
          : canvas_meta.scenery_preview_url === SCENERY_ERROR
            ? "error"
            : "pending";
        return { status, canvas_meta };
      }
    }
  }

  if (meta.scenery_pipeline_stage !== "base" || !meta.scenery_fal_request_id) {
    if (meta.scenery_pipeline_stage === "error") {
      return { status: "error", canvas_meta: meta };
    }
    if (isSceneryPreviewResolved(meta.scenery_preview_url)) {
      return { status: "complete", canvas_meta: meta };
    }
    if (meta.scenery_preview_url === SCENERY_PENDING) {
      return { status: "pending", canvas_meta: meta };
    }
    return null;
  }

  const model =
    meta.scenery_fal_model ??
    (meta.scenery_wireframe_url
      ? SCENERY_FLUX_IMG2IMG_MODEL
      : SCENERY_FLUX_TEXT_MODEL);
  const requestId = meta.scenery_fal_request_id;

  try {
    const queueStatus = await fal.queue.status(model, { requestId });

    if (
      queueStatus.status === "IN_QUEUE" ||
      queueStatus.status === "IN_PROGRESS"
    ) {
      return { status: "pending", canvas_meta: meta };
    }

    if (queueStatus.status !== "COMPLETED") {
      const canvas_meta = await updateProjectSceneryMeta(
        supabase,
        projectId,
        canvasState,
        {
          scenery_preview_url: SCENERY_ERROR,
          scenery_pipeline_stage: "error",
          scenery_fal_request_id: null,
        },
      );
      return { status: "error", canvas_meta };
    }

    const falImageUrl = await fetchFalResultImageUrl(model, requestId);
    if (!falImageUrl) {
      const canvas_meta = await updateProjectSceneryMeta(
        supabase,
        projectId,
        canvasState,
        {
          scenery_preview_url: SCENERY_ERROR,
          scenery_pipeline_stage: "error",
          scenery_fal_request_id: null,
        },
      );
      return { status: "error", canvas_meta };
    }

    const storageUrl = await uploadGeneratedImage(
      supabase,
      requestId,
      falImageUrl,
    );
    const baseUrl = storageUrl ?? falImageUrl;

    const canvas_meta = await continuePipelineAfterBase(
      supabase,
      projectId,
      canvasState,
      baseUrl,
    );

    const status = isSceneryPreviewResolved(canvas_meta.scenery_preview_url)
      ? "complete"
      : canvas_meta.scenery_preview_url === SCENERY_ERROR
        ? "error"
        : "pending";

    return { status, canvas_meta };
  } catch (err) {
    console.warn("Tier B scenery poll failed:", err);
    return { status: "pending", canvas_meta: meta };
  }
}

export async function pollAndCompleteScenery(
  supabase: SupabaseClient<Database>,
  projectId: string,
  canvasState: Record<string, unknown> | null | undefined,
): Promise<{
  status: "idle" | "pending" | "complete" | "error";
  canvas_meta: CanvasMeta;
}> {
  const meta = extractCanvasMeta(canvasState);

  if (isSceneryPreviewResolved(meta.scenery_preview_url)) {
    return { status: "complete", canvas_meta: meta };
  }

  if (meta.scenery_preview_url === SCENERY_ERROR) {
    return { status: "error", canvas_meta: meta };
  }

  const pipelineResult = await pollSceneryPipeline(
    supabase,
    projectId,
    canvasState,
    meta,
  );
  if (pipelineResult) return pipelineResult;

  if (!meta.scenery_fal_request_id) {
    return { status: "idle", canvas_meta: meta };
  }

  if (isScenerySynthesisStale(meta)) {
    const canvas_meta = await updateProjectSceneryMeta(
      supabase,
      projectId,
      canvasState,
      {
        scenery_preview_url: SCENERY_ERROR,
        scenery_fal_request_id: null,
        scenery_pipeline_stage: "error",
      },
    );
    return { status: "error", canvas_meta };
  }

  if (!process.env.FAL_KEY) {
    const canvas_meta = await updateProjectSceneryMeta(
      supabase,
      projectId,
      canvasState,
      {
        scenery_preview_url: null,
        scenery_fal_request_id: null,
      },
    );
    return { status: "error", canvas_meta };
  }

  const model =
    meta.scenery_fal_model ??
    (meta.scenery_fal_request_id ? SCENERY_FLUX_IMG2IMG_MODEL : SCENERY_FLUX_TEXT_MODEL);
  const requestId = meta.scenery_fal_request_id;

  try {
    const queueStatus = await fal.queue.status(model, { requestId });

    if (
      queueStatus.status === "IN_QUEUE" ||
      queueStatus.status === "IN_PROGRESS"
    ) {
      return { status: "pending", canvas_meta: meta };
    }

    if (queueStatus.status !== "COMPLETED") {
      const canvas_meta = await updateProjectSceneryMeta(
        supabase,
        projectId,
        canvasState,
        {
          scenery_preview_url: SCENERY_ERROR,
          scenery_fal_request_id: null,
        },
      );
      return { status: "error", canvas_meta };
    }

    const result = await fal.queue.result(model, { requestId });
    const falImageUrl = getFalImageUrl(result.data);
    if (!falImageUrl) {
      const canvas_meta = await updateProjectSceneryMeta(
        supabase,
        projectId,
        canvasState,
        {
          scenery_preview_url: SCENERY_ERROR,
          scenery_fal_request_id: null,
        },
      );
      return { status: "error", canvas_meta };
    }

    const storageUrl = await uploadGeneratedImage(
      supabase,
      requestId,
      falImageUrl,
    );
    if (!storageUrl) {
      const canvas_meta = await updateProjectSceneryMeta(
        supabase,
        projectId,
        canvasState,
        {
          scenery_preview_url: SCENERY_ERROR,
          scenery_fal_request_id: null,
        },
      );
      return { status: "error", canvas_meta };
    }

    const canvas_meta = await updateProjectSceneryMeta(
      supabase,
      projectId,
      canvasState,
      {
        scenery_preview_url: storageUrl,
        scenery_fal_request_id: null,
      },
    );
    return { status: "complete", canvas_meta };
  } catch (err) {
    console.warn("Scenery poll failed:", err);
    return { status: "pending", canvas_meta: meta };
  }
}
