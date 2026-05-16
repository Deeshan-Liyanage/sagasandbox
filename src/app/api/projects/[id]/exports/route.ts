import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import {
  getEdgeFunctionInvokeHeaders,
  getSupabaseAdminKey,
} from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId } = await context.params;

  try {
    const body = (await request.json()) as {
      type: "storyboard_pdf" | "audio_script";
      event_ids: string[];
    };

    if (!body.type || !Array.isArray(body.event_ids)) {
      return NextResponse.json(
        { error: "type and event_ids are required" },
        { status: 400 },
      );
    }

    const { data: exportRow, error } = await supabase
      .from("exports")
      .insert({
        project_id: projectId,
        type: body.type,
        event_ids: body.event_ids,
        status: "queued",
      })
      .select()
      .single();

    if (error || !exportRow) return jsonError(error?.message ?? "Insert failed");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const adminKey = getSupabaseAdminKey();

    if (supabaseUrl && adminKey) {
      void fetch(`${supabaseUrl}/functions/v1/process-export`, {
        method: "POST",
        headers: getEdgeFunctionInvokeHeaders(adminKey),
        body: JSON.stringify({ export_id: exportRow.id }),
      }).catch(() => {
        // Edge function may not be deployed yet (Agent B)
      });
    }

    return NextResponse.json({ export: exportRow }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
