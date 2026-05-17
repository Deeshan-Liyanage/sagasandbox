import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { normalizeUuidParam } from "@/lib/supabase-storage-object-path";
import { resolveExportArtifacts } from "@/lib/supabase-export-artifacts";

type RouteContext = { params: Promise<{ id: string; expId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectIdRaw, expId: expIdRaw } = await context.params;
  const projectId = normalizeUuidParam(projectIdRaw);
  const expId = normalizeUuidParam(expIdRaw);

  try {
    const { data: exportRow, error: selErr } = await supabase
      .from("exports")
      .select("*")
      .eq("id", expId)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json(
        { error: selErr.message ?? "Failed to load export row" },
        { status: 500 },
      );
    }

    if (!exportRow) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    const rowProjectId = normalizeUuidParam(exportRow.project_id as string);
    if (rowProjectId !== projectId) {
      return NextResponse.json(
        { error: "Export does not belong to this project." },
        { status: 403 },
      );
    }

    const artifacts =
      exportRow.status === "done"
        ? await resolveExportArtifacts(supabase, exportRow)
        : [];

    const signed_url = artifacts[0]?.url;

    return NextResponse.json({
      export: exportRow,
      signed_url,
      artifacts,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
