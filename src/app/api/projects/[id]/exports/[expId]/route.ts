import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string; expId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId, expId } = await context.params;

  try {
    const { data: exportRow, error } = await supabase
      .from("exports")
      .select("*")
      .eq("id", expId)
      .eq("project_id", projectId)
      .single();

    if (error || !exportRow) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    let signed_url: string | undefined;

    if (exportRow.status === "done" && exportRow.output_url) {
      try {
        const url = new URL(exportRow.output_url);
        const pathParts = url.pathname.split("/storage/v1/object/public/");
        const storagePath = pathParts[1];
        if (storagePath) {
          const [bucket, ...rest] = storagePath.split("/");
          const objectPath = rest.join("/");
          const { data: signed } = await supabase.storage
            .from(bucket)
            .createSignedUrl(objectPath, 3600);
          signed_url = signed?.signedUrl;
        }
      } catch {
        signed_url = exportRow.output_url;
      }
    }

    return NextResponse.json({ export: exportRow, signed_url });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
