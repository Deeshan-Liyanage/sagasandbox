import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import {
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

    const { prompt, hasSketchReference, warnings } = resolved.data;

    return NextResponse.json({
      prompt,
      has_sketch_reference: hasSketchReference,
      warnings,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
