import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { mergeCanvasStateWithMeta } from "@/lib/canvas-meta";
import { buildPrompt, falQueue, projectStyleConfig } from "@/lib/fal";
import { falDepthMap } from "@/lib/fal-media";
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
    };

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const styleConfig = projectStyleConfig(project);
    const prompt = buildPrompt({
      styleConfig,
      description:
        body.sketch_description ??
        "Transform this sketch into a cinematic environment backdrop",
    });

    const result = await falQueue({
      prompt,
      imageUrl: body.reference_image_url,
      width: 1280,
      height: 720,
    });

    if (!result) {
      const erroredState = mergeCanvasStateWithMeta(
        project.canvas_state as Record<string, unknown> | null,
        {
          scenery_preview_url: null,
          scenery_request_id: null,
          last_synthesis_at: new Date().toISOString(),
        },
      );
      await supabase
        .from("projects")
        .update({ canvas_state: erroredState as Json })
        .eq("id", projectId);

      return NextResponse.json(
        { error: "FAL_KEY not configured — image generation disabled" },
        { status: 503 },
      );
    }

    let depthPreviewUrl: string | null = null;
    if (body.reference_image_url) {
      depthPreviewUrl = await falDepthMap(body.reference_image_url);
    }

    const sceneryUrl = result.imageUrl ?? "pending";
    const canvasState = mergeCanvasStateWithMeta(
      project.canvas_state as Record<string, unknown> | null,
      {
        scenery_preview_url: sceneryUrl,
        scenery_request_id: result.requestId,
        depth_preview_url: depthPreviewUrl,
        last_synthesis_at: new Date().toISOString(),
      },
    );

    await supabase
      .from("projects")
      .update({ canvas_state: canvasState as Json })
      .eq("id", projectId);

    return NextResponse.json({
      request_id: result.requestId,
      scenery_preview_url: sceneryUrl,
      depth_preview_url: depthPreviewUrl,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
