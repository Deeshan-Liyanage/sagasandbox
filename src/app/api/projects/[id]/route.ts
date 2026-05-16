import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { falQueue, projectStyleConfig } from "@/lib/fal";
import type { Database, Json } from "@/types/db";

type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      theme?: string;
      aesthetic_style?: string;
      style_config?: Record<string, unknown>;
      canvas_state?: Record<string, unknown>;
      cascade?: boolean;
    };

    const updates: ProjectUpdate = {};
    if (body.theme !== undefined) updates.theme = body.theme;
    if (body.aesthetic_style !== undefined)
      updates.aesthetic_style = body.aesthetic_style;
    if (body.style_config !== undefined) updates.style_config = body.style_config as Json;
    if (body.canvas_state !== undefined) updates.canvas_state = body.canvas_state as Json;

    const { data: project, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let queued = 0;

    if (body.cascade) {
      const styleConfig = projectStyleConfig(project);

      const { data: pins } = await supabase
        .from("location_pins")
        .select("*")
        .eq("project_id", id);

      const { data: events } = await supabase
        .from("timeline_events")
        .select("*")
        .eq("project_id", id);

      for (const pin of pins ?? []) {
        await supabase
          .from("location_pins")
          .update({ gen_status: "pending" })
          .eq("id", pin.id);

        try {
          const prompt = `${styleConfig.aesthetic_style} ${styleConfig.theme} location: ${pin.label}. ${pin.description ?? ""}`;
          const result = await falQueue({ prompt });
          if (result) {
            await supabase
              .from("location_pins")
              .update({
                gen_status: "generating",
                fal_request_id: result.requestId,
              })
              .eq("id", pin.id);
            queued++;
          }
        } catch {
          // fal may be unavailable during scaffold
        }
      }

      for (const event of events ?? []) {
        await supabase
          .from("timeline_events")
          .update({ gen_status: "pending" })
          .eq("id", event.id);

        try {
          const prompt = `${styleConfig.aesthetic_style} scene: ${event.description ?? event.title}`;
          const result = await falQueue({ prompt });
          if (result) {
            await supabase
              .from("timeline_events")
              .update({
                gen_status: "generating",
                fal_request_id: result.requestId,
              })
              .eq("id", event.id);
            queued++;
          }
        } catch {
          // fal may be unavailable during scaffold
        }
      }
    }

    return NextResponse.json({ project, queued: body.cascade ? queued : undefined });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
