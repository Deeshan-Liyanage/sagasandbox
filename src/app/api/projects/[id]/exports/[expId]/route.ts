import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import {
  normalizeUuidParam,
  parseSupabaseStorageObjectRef,
} from "@/lib/supabase-storage-object-path";
import type { Database } from "@/types/db";

type RouteContext = { params: Promise<{ id: string; expId: string }> };

async function deriveFreshSignedDownloadUrl(
  supabase: SupabaseClient<Database>,
  outputUrl: string,
): Promise<string | undefined> {
  const out = outputUrl.trim();
  if (!out) return undefined;

  if (!/^https?:\/\//i.test(out)) {
    const objectPath = out.replace(/^\/+/, "");
    const { data: bareSigned } = await supabase.storage
      .from("exports")
      .createSignedUrl(objectPath, 3600);
    return bareSigned?.signedUrl ?? undefined;
  }

  const ref = parseSupabaseStorageObjectRef(out);
  if (ref) {
    const { data: refreshed } = await supabase.storage
      .from(ref.bucket)
      .createSignedUrl(ref.objectPath, 3600);
    return refreshed?.signedUrl ?? undefined;
  }

  return out;
}

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

    let signed_url: string | undefined;

    if (exportRow.status === "done" && exportRow.output_url) {
      try {
        signed_url = await deriveFreshSignedDownloadUrl(
          supabase,
          exportRow.output_url as string,
        );
      } catch {
        signed_url = exportRow.output_url as string;
      }
    }

    return NextResponse.json({ export: exportRow, signed_url });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
