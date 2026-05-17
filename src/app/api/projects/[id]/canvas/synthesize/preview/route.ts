import "server-only";

import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { generateSceneryLayoutPlan } from "@/lib/scenery-layout-plan";
import { buildBaseMapPrompt } from "@/lib/scenery-pipeline-prompt";
import { renderWireframeDataUrl } from "@/lib/scenery-wireframe";
import {
  resolveSceneryPrompt,
  resolveScenerySynthesis,
  validateScenerySynthesizeBody,
  type ScenerySynthesizeRequestBody,
} from "@/lib/scenery-synthesize-request";

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

    const resolved = await resolveScenerySynthesis(supabase, projectId, body, {
      forPreview: true,
    });
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const { project, geospatial, synthesisUserNotes, warnings } = resolved.data;

    const { plan: layoutPlan, source: layoutPlanSource } =
      await generateSceneryLayoutPlan({
        project,
        geospatial,
        synthesis_user_notes: synthesisUserNotes,
      });

    const builtPrompt = buildBaseMapPrompt(
      project,
      layoutPlan,
      geospatial,
      synthesisUserNotes,
    );
    const prompt = resolveSceneryPrompt(builtPrompt, body.prompt_override);

    let wireframeThumbnail: string | null = null;
    try {
      wireframeThumbnail = await renderWireframeDataUrl(layoutPlan, geospatial);
    } catch (err) {
      console.warn("[scenery preview] wireframe render failed:", err);
    }

    return NextResponse.json({
      prompt,
      default_prompt: prompt,
      has_sketch_reference: true,
      used_tier_b_pipeline: true,
      layout_plan: layoutPlan,
      layout_plan_source: layoutPlanSource,
      wireframe_thumbnail: wireframeThumbnail,
      warnings,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
