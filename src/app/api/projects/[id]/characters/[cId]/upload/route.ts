import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string; cId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, cId } = await context.params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const path = `characters/${cId}/reference.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(path, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) return jsonError(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(path);

    const { data: character, error } = await supabase
      .from("characters")
      .update({ reference_image_url: publicUrl })
      .eq("id", cId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error || !character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    return NextResponse.json({ reference_image_url: publicUrl });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
