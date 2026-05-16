import { NextResponse } from "next/server";
import { isAuthError, jsonError, requireAuth } from "@/lib/api-auth";
import { extractCanvasMeta, patchCanvasMeta } from "@/lib/canvas-state";
import { uploadCanvasSketchDataUrl } from "@/lib/canvas-sketch-upload";
import { FLUX_IMG2IMG_MODEL, FLUX_TEXT_MODEL, falQueue } from "@/lib/fal";
import { falDepthMap } from "@/lib/fal-media";
import {
  buildScenerySynthesisPrompt,
  type SceneryGeospatialContext,
} from "@/lib/scenery-prompt";
import { SCENERY_PENDING } from "@/lib/scenery-synthesis";
import type { Json } from "@/types/db";

type RouteContext = { params: Promise<{ id: string }> };

/** Reject oversized data URLs before decode/upload (Vercel body limits). */
const MAX_SKETCH_DATA_URL_CHARS = 4 * 1024 * 1024;

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const { supabase } = auth;
  const { id: projectId } = await context.params;

  try {
    const body = (await request.json()) as {
      reference_image_url?: string;
      sketch_data_url?: string;
      has_strokes?: boolean;
      synthesis_user_notes?: string | null;
      geospatial?: SceneryGeospatialContext;
    };

    const sketchLen = body.sketch_data_url?.length ?? 0;
    if (sketchLen > MAX_SKETCH_DATA_URL_CHARS) {
      return NextResponse.json(
        { error: "Map sketch exceeds maximum upload size (4MB)" },
        { status: 413 },
      );
    }

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: pins } = await supabase
      .from("location_pins")
      .select("label, description, canvas_x, canvas_y")
      .eq("project_id", projectId);

    const dbPins = (pins ?? []).map((p) => ({
      label: p.label?.trim() || "Unnamed",
      description: p.description,
      canvas_x: p.canvas_x,
      canvas_y: p.canvas_y,
    }));

    const geospatial: SceneryGeospatialContext = body.geospatial
      ? {
          ...body.geospatial,
          pins: body.geospatial.pins?.length ? body.geospatial.pins : dbPins,
        }
      : {
          canvas_width: 800,
          canvas_height: 600,
          stroke_count: body.has_strokes ? 1 : 0,
          stroke_point_count: 0,
          stroke_bounds: null,
          pins: dbPins,
        };

    const existingMeta = extractCanvasMeta(
      project.canvas_state as Record<string, unknown> | null,
    );
    const synthesisUserNotes =
      body.synthesis_user_notes !== undefined
        ? body.synthesis_user_notes
        : (existingMeta.synthesis_user_notes ?? null);

    const clientSentSketch = Boolean(body.sketch_data_url?.trim());
    let referenceImageUrl = body.reference_image_url ?? null;
    let sketchUploadFailed = false;

    if (!referenceImageUrl && body.sketch_data_url) {
      referenceImageUrl = await uploadCanvasSketchDataUrl(
        supabase,
        projectId,
        body.sketch_data_url,
      );
      if (!referenceImageUrl) {
        sketchUploadFailed = true;
      }
    }

    const hasSketchReference = Boolean(referenceImageUrl);
    const prompt = buildScenerySynthesisPrompt({
      project,
      hasSketchReference,
      geospatial,
      synthesis_user_notes: synthesisUserNotes,
    });

    const warnings: string[] = [];
    if (body.has_strokes === false) {
      warnings.push(
        "No brush strokes on the map — generating from theme and location pins only.",
      );
    }
    if (clientSentSketch && sketchUploadFailed) {
      warnings.push(
        "Could not upload the map sketch; generating from text only.",
      );
    }

    if (!process.env.FAL_KEY) {
      const canvasState = patchCanvasMeta(
        project.canvas_state as Record<string, unknown> | null,
        {
          scenery_preview_url: null,
          scenery_fal_request_id: null,
          scenery_fal_model: null,
          last_synthesis_at: new Date().toISOString(),
          synthesis_user_notes: synthesisUserNotes,
        },
      );

      await supabase
        .from("projects")
        .update({ canvas_state: canvasState as Json })
        .eq("id", projectId);

      return NextResponse.json({
        queued: false,
        message:
          "Image generation is not configured. Set FAL_KEY on the server to enable scenery synthesis.",
        request_id: null,
        depth_preview_url: null,
        used_sketch_reference: false,
        warnings,
        canvas_meta: extractCanvasMeta(canvasState),
      });
    }

    const falModel = hasSketchReference ? FLUX_IMG2IMG_MODEL : FLUX_TEXT_MODEL;

    const result = await falQueue({
      prompt,
      model: falModel,
      imageUrl: referenceImageUrl ?? undefined,
      width: 1280,
      height: 720,
      strength: hasSketchReference ? 0.88 : undefined,
    });

    let depthPreviewUrl: string | null = null;
    if (referenceImageUrl) {
      depthPreviewUrl = await falDepthMap(referenceImageUrl);
    }

    const canvasState = patchCanvasMeta(
      project.canvas_state as Record<string, unknown> | null,
      {
        scenery_preview_url: result ? SCENERY_PENDING : null,
        scenery_fal_request_id: result?.requestId ?? null,
        scenery_fal_model: result ? falModel : null,
        depth_preview_url: depthPreviewUrl,
        last_synthesis_at: new Date().toISOString(),
        synthesis_user_notes: synthesisUserNotes,
      },
    );

    await supabase
      .from("projects")
      .update({ canvas_state: canvasState as Json })
      .eq("id", projectId);

    return NextResponse.json({
      queued: Boolean(result),
      message: result
        ? hasSketchReference
          ? "Scenery generation queued from your map sketch"
          : "Scenery generation queued (text only)"
        : "Failed to queue scenery generation",
      request_id: result?.requestId ?? null,
      depth_preview_url: depthPreviewUrl,
      used_sketch_reference: hasSketchReference,
      warnings,
      canvas_meta: extractCanvasMeta(canvasState),
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Unknown error");
  }
}
