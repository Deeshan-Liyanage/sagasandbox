import type { SupabaseClient } from "@supabase/supabase-js";
import { fal } from "@fal-ai/client";
import {
  extractCanvasMeta,
  patchCanvasMeta,
  type CanvasMeta,
} from "@/lib/canvas-state";
import type { Database, Json } from "@/types/db";

export const SCENERY_FLUX_MODEL = "fal-ai/flux/dev";
export const SCENERY_PENDING = "pending";
export const SCENERY_ERROR = "error";
export const SCENERY_SYNTHESIS_TIMEOUT_MS = 5 * 60 * 1000;

type FalImagePayload = {
  images?: Array<{ url?: string }>;
  image?: { url?: string };
};

/** Fal webhooks use `payload`; older code expected `output`. */
export function getFalImageUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const data = result as FalImagePayload;
  return data.images?.[0]?.url ?? data.image?.url ?? null;
}

export async function uploadGeneratedImage(
  supabase: SupabaseClient<Database>,
  requestId: string,
  sourceUrl: string,
): Promise<string | null> {
  const imgResponse = await fetch(sourceUrl);
  if (!imgResponse.ok) return null;

  const blob = await imgResponse.blob();
  const fileName = `generated/${requestId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("images")
    .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    console.warn("Scenery image upload failed:", uploadError.message);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("images").getPublicUrl(fileName);

  return publicUrl;
}

export async function updateProjectSceneryMeta(
  supabase: SupabaseClient<Database>,
  projectId: string,
  existingState: Record<string, unknown> | null | undefined,
  patch: Partial<CanvasMeta>,
): Promise<CanvasMeta> {
  const nextState = patchCanvasMeta(existingState, patch);
  await supabase
    .from("projects")
    .update({ canvas_state: nextState as Json })
    .eq("id", projectId);
  return extractCanvasMeta(nextState);
}

export function isSceneryPreviewResolved(url: string | null | undefined): boolean {
  if (!url) return false;
  return url !== SCENERY_PENDING && url !== SCENERY_ERROR;
}

export function isScenerySynthesisStale(meta: CanvasMeta): boolean {
  if (meta.scenery_preview_url !== SCENERY_PENDING || !meta.last_synthesis_at) {
    return false;
  }
  const started = Date.parse(meta.last_synthesis_at);
  if (Number.isNaN(started)) return false;
  return Date.now() - started > SCENERY_SYNTHESIS_TIMEOUT_MS;
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

  const model = SCENERY_FLUX_MODEL;
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
