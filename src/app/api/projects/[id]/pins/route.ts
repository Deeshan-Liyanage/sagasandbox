import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { falQueue, projectStyleConfig } from "@/lib/fal";
import type { Database } from "@/types/db";

type PinUpdate = Database["public"]["Tables"]["location_pins"]["Update"];

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId } = await context.params;

  try {
    const body = (await request.json()) as {
      label: string;
      description?: string;
      canvas_x: number;
      canvas_y: number;
    };

    if (!body.label || body.canvas_x === undefined || body.canvas_y === undefined) {
      return NextResponse.json(
        { error: "label, canvas_x, and canvas_y are required" },
        { status: 400 },
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: pin, error: insertError } = await supabase
      .from("location_pins")
      .insert({
        project_id: projectId,
        label: body.label,
        description: body.description ?? null,
        canvas_x: body.canvas_x,
        canvas_y: body.canvas_y,
        gen_status: "pending",
      })
      .select()
      .single();

    if (insertError || !pin) return jsonError(insertError?.message ?? "Insert failed");

    const styleConfig = projectStyleConfig(project);
    const prompt = `${styleConfig.aesthetic_style} ${styleConfig.tone} location: ${body.label}. ${body.description ?? ""}`;

    try {
      const result = await falQueue({ prompt, model: "fal-ai/flux/dev" });
      if (result) {
        const updatePayload: PinUpdate = {
          gen_status: result.imageUrl ? "done" : "generating",
          fal_request_id: result.requestId,
          ...(result.imageUrl ? { generated_image_url: result.imageUrl } : {}),
        };
        const { data: updated } = await supabase
          .from("location_pins")
          .update(updatePayload)
          .eq("id", pin.id)
          .select()
          .single();

        return NextResponse.json({ pin: updated ?? pin }, { status: 201 });
      }
    } catch (falErr) {
      console.error("[pins POST] falQueue failed:", falErr);
      // Return pin without generation if fal fails
    }

    return NextResponse.json({ pin }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
