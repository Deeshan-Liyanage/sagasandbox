import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { extractCanvasMeta, patchCanvasMeta } from "@/lib/canvas-state";
import { uploadCanvasSketchDataUrl } from "@/lib/canvas-sketch-upload";
import { buildPrompt, falQueue, projectStyleConfig } from "@/lib/fal";
import { falDepthMap } from "@/lib/fal-media";
import { SCENERY_PENDING } from "@/lib/scenery-synthesis";
import type { Json } from "@/types/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId } = await context.params;

  try {
    const body = (await request.json()) as {
      sketch_description?: string;
      reference_image_url?: string;
      sketch_data_url?: string;
    };

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let referenceImageUrl = body.reference_image_url ?? null;
    if (!referenceImageUrl && body.sketch_data_url) {
      referenceImageUrl = await uploadCanvasSketchDataUrl(
        supabase,
        projectId,
        body.sketch_data_url,
      );
    }

    const styleConfig = projectStyleConfig(project);
    const prompt = buildPrompt({
      styleConfig,
      description:
        body.sketch_description ??
        "Transform this sketch into a cinematic environment backdrop",
    });

    if (!process.env.FAL_KEY) {
      const canvasState = patchCanvasMeta(
        project.canvas_state as Record<string, unknown> | null,
        {
          scenery_preview_url: null,
          scenery_fal_request_id: null,
          last_synthesis_at: new Date().toISOString(),
        },
      );

      await supabase
        .from("projects")
        .update({ canvas_state: canvasState as Json })
        .eq("id", projectId);

      return NextResponse.json({
        queued: false,
        message:
          "Image generation is not configured. Set FAL_KEY on the server to enable scenery synthesis.",
        request_id: null,
        depth_preview_url: null,
        canvas_meta: extractCanvasMeta(canvasState),
      });
    }

    const result = await falQueue({
      prompt,
      imageUrl: referenceImageUrl ?? undefined,
      width: 1280,
      height: 720,
    });

    let depthPreviewUrl: string | null = null;
    if (referenceImageUrl) {
      depthPreviewUrl = await falDepthMap(referenceImageUrl);
    }

    const canvasState = patchCanvasMeta(
      project.canvas_state as Record<string, unknown> | null,
      {
        scenery_preview_url: result ? SCENERY_PENDING : null,
        scenery_fal_request_id: result?.requestId ?? null,
        depth_preview_url: depthPreviewUrl,
        last_synthesis_at: new Date().toISOString(),
      },
    );

    await supabase
      .from("projects")
      .update({ canvas_state: canvasState as Json })
      .eq("id", projectId);

    return NextResponse.json({
      queued: Boolean(result),
      message: result
        ? "Scenery generation queued"
        : "Failed to queue scenery generation",
      request_id: result?.requestId ?? null,
      depth_preview_url: depthPreviewUrl,
      canvas_meta: extractCanvasMeta(canvasState),
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
