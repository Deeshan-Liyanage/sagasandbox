import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { normalizeUuidParam } from "@/lib/supabase-storage-object-path";
import {
  resolveExportSources,
  type ResolvedExportSource,
} from "@/lib/supabase-export-artifacts";

type RouteContext = { params: Promise<{ id: string; expId: string }> };

const MAX_INDEX = 50;

function encodeRfc5987(value: string): string {
  // RFC 5987 — works for filenames containing UTF-8 / accented characters.
  return encodeURIComponent(value)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
}

function buildDispositionHeader(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(
    filename,
  )}`;
}

/**
 * Server-side download proxy. Returns the actual bytes (not JSON) so the
 * browser saves them via the standard `Content-Disposition: attachment`
 * mechanism. This sidesteps every CORS / signed-URL-expiry edge case the
 * client had to juggle previously.
 *
 * Query params:
 *   ?index=N   — zero-based artifact index (defaults to 0)
 *   ?list=1    — return a JSON manifest of all available artifacts instead of
 *                streaming bytes (used by the terminal to show per-file links).
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;

  const { id: projectIdRaw, expId: expIdRaw } = await context.params;
  const projectId = normalizeUuidParam(projectIdRaw);
  const expId = normalizeUuidParam(expIdRaw);

  const url = new URL(request.url);
  const listMode = url.searchParams.get("list") === "1";
  const indexRaw = url.searchParams.get("index") ?? "0";
  const index = Number.parseInt(indexRaw, 10);
  if (!listMode && (!Number.isFinite(index) || index < 0 || index > MAX_INDEX)) {
    return jsonError("Invalid file index", 400);
  }

  try {
    const { data: exportRow, error: selErr } = await supabase
      .from("exports")
      .select("id, project_id, type, status, output_url")
      .eq("id", expId)
      .maybeSingle();

    if (selErr) return jsonError(selErr.message ?? "Failed to load export", 500);
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

    if (exportRow.status !== "done") {
      return NextResponse.json(
        {
          error:
            "Export has not finished yet. Wait for the status to update to done.",
          status: exportRow.status,
        },
        { status: 409 },
      );
    }

    const sources = await resolveExportSources(supabase, exportRow);

    if (sources.length === 0) {
      return NextResponse.json(
        {
          error:
            "We could not locate any downloadable files for this export. The render may have failed silently — try regenerating it.",
          status: exportRow.status,
          output_url: exportRow.output_url ?? null,
        },
        { status: 404 },
      );
    }

    if (listMode) {
      return NextResponse.json({
        files: sources.map((s) => ({
          filename: s.filename,
          contentType: s.contentType ?? null,
        })),
      });
    }

    const source = sources[index];
    if (!source) {
      return NextResponse.json(
        { error: `No file at index ${index}.`, available: sources.length },
        { status: 404 },
      );
    }

    const result = await streamSource(source);
    if (!result) {
      return NextResponse.json(
        {
          error:
            "We located the file metadata but the underlying asset could not be fetched.",
          source: source.kind,
        },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", result.contentType);
    headers.set("Content-Disposition", buildDispositionHeader(source.filename));
    headers.set("Cache-Control", "private, no-store");
    if (result.contentLength !== undefined) {
      headers.set("Content-Length", String(result.contentLength));
    }
    return new Response(result.body, { headers });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }

  async function streamSource(source: ResolvedExportSource): Promise<{
    body: ReadableStream<Uint8Array> | ArrayBuffer;
    contentType: string;
    contentLength?: number;
  } | null> {
    if (source.kind === "storage") {
      const { data, error } = await supabase.storage
        .from(source.bucket)
        .download(source.objectPath);
      if (error || !data) return null;
      const buf = await data.arrayBuffer();
      return {
        body: buf,
        contentType: source.contentType ?? data.type ?? "application/octet-stream",
        contentLength: buf.byteLength,
      };
    }

    const upstream = await fetch(source.url);
    if (!upstream.ok || !upstream.body) return null;
    const ct =
      upstream.headers.get("content-type") ??
      source.contentType ??
      "application/octet-stream";
    const len = upstream.headers.get("content-length");
    return {
      body: upstream.body,
      contentType: ct,
      contentLength: len ? Number.parseInt(len, 10) : undefined,
    };
  }
}
