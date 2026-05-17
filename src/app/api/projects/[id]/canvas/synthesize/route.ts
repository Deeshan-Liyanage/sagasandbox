import "server-only";

import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { extractCanvasMeta, patchCanvasMeta } from "@/lib/canvas-state";
import { falDepthMap } from "@/lib/fal-media";
import { startTierBPipeline } from "@/lib/scenery-pipeline";
import {
  resolveScenerySynthesis,
  validateScenerySynthesizeBody,
  type ScenerySynthesizeRequestBody,
} from "@/lib/scenery-synthesize-request";
import type { Json } from "@/types/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId } = await context.params;

  try {
    const body = (await request.json()) as ScenerySynthesizeRequestBody;

    const validation = validateScenerySynthesizeBody(body);
    if (validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const resolved = await resolveScenerySynthesis(supabase, projectId, body);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const { project, geospatial, synthesisUserNotes, warnings } = resolved.data;

    const promptOverride = body.prompt_override?.trim() || undefined;

    const pipeline = await startTierBPipeline(supabase, {
      project: {
        id: projectId,
        name: project.name,
        theme: project.theme,
        aesthetic_style: project.aesthetic_style,
        style_config: project.style_config,
        canvas_state: project.canvas_state,
      },
      geospatial,
      synthesisUserNotes,
      promptOverride,
    });

    let depthPreviewUrl: string | null = null;
    const wireframeUrl = pipeline.wireframeUrl;
    if (wireframeUrl) {
      depthPreviewUrl = await falDepthMap(wireframeUrl);
    }

    if (depthPreviewUrl) {
      const next = patchCanvasMeta(pipeline.canvasState, {
        depth_preview_url: depthPreviewUrl,
      });
      await supabase
        .from("projects")
        .update({ canvas_state: next as Json })
        .eq("id", projectId);
      pipeline.canvasState = next;
    }

    const canvas_meta = extractCanvasMeta(pipeline.canvasState);

    return NextResponse.json({
      queued: pipeline.queued && !pipeline.completedInline,
      message: pipeline.message,
      request_id: pipeline.requestId,
      depth_preview_url: depthPreviewUrl,
      used_sketch_reference: Boolean(wireframeUrl),
      used_tier_b_pipeline: true,
      scenery_pipeline_stage: canvas_meta.scenery_pipeline_stage,
      layout_plan: pipeline.layoutPlan,
      layout_plan_source: pipeline.layoutPlanSource,
      wireframe_url: wireframeUrl,
      warnings,
      canvas_meta,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
