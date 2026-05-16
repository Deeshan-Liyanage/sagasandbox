import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import type { ProjectInsert } from "@/types/app";
import type { Json } from "@/types/db";

export async function GET() {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { user, supabase } = auth;

  try {
    const { data: owned, error: ownedError } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (ownedError) return jsonError(ownedError.message);

    const { data: memberships, error: memberError } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id);

    if (memberError) return jsonError(memberError.message);

    const memberIds = (memberships ?? [])
      .map((m) => m.project_id)
      .filter((id) => !(owned ?? []).some((p) => p.id === id));

    let shared: typeof owned = [];
    if (memberIds.length > 0) {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .in("id", memberIds)
        .order("created_at", { ascending: false });
      if (error) return jsonError(error.message);
      shared = data ?? [];
    }

    const projects = [...(owned ?? []), ...shared];
    return NextResponse.json({ projects });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { user, supabase } = auth;

  try {
    const body = (await request.json()) as {
      name: string;
      theme: string;
      aesthetic_style: string;
      style_config?: Record<string, unknown>;
    };

    if (!body.name || !body.theme || !body.aesthetic_style) {
      return NextResponse.json(
        { error: "name, theme, and aesthetic_style are required" },
        { status: 400 },
      );
    }

    const insert: ProjectInsert = {
      owner_id: user.id,
      name: body.name,
      theme: body.theme,
      aesthetic_style: body.aesthetic_style,
      style_config: (body.style_config ?? {
        theme: body.theme,
        aesthetic_style: body.aesthetic_style,
      }) as Json,
    };

    const { data: project, error } = await supabase
      .from("projects")
      .insert(insert)
      .select()
      .single();

    if (error || !project) return jsonError(error?.message ?? "Insert failed");

    const { error: memberError } = await supabase.from("project_members").insert({
      project_id: project.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) return jsonError(memberError.message);

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
