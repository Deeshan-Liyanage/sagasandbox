/**
 * Demo seed — rich SagaSandbox playground aligned with PRD workflows:
 * Universe initializer (theme/style), geography pins + Konva sketch + Tier‑B scenery meta,
 * timeline with pin links, voice‑named characters + event_characters, ghost beat + Copilot pending,
 * audio summaries (voice‑note narrative), snapshots/history, agent logs.
 *
 * Usage:
 *   npm run seed:demo
 *   # or: npx tsx scripts/seed-demo.ts
 *
 * Env files (same as Next.js — loaded automatically here): `.env`, `.env.local`
 * Real shell env vars still override file values.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (or legacy service role)
 *   DEMO_OWNER_ID — auth.users UUID that owns the demo project
 *   DEMO_OVERWRITE=true — delete existing demo project by name and recreate (destructive)
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/db";

const repoRoot = path.resolve(import.meta.dirname, "..");

loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.local"), override: true });

const DEMO_PROJECT_NAME = "The Obsidian Covenant";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = (
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SB_KEY
)?.trim();
const ownerIdEnv = process.env.DEMO_OWNER_ID?.trim();
const overwrite = process.env.DEMO_OVERWRITE === "true";

if (!url || !serviceKey) {
  console.error(
    [
      "Missing Supabase env for seed script.",
      "Expected NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).",
      "Put them in .env.local at the repo root, or export them in your shell.",
      `Loaded env from (repo root): ${repoRoot}`,
    ].join("\n"),
  );
  process.exit(1);
}

if (!ownerIdEnv) {
  console.error("Set DEMO_OWNER_ID to an auth.users UUID for the demo owner");
  process.exit(1);
}

const ownerId: string = ownerIdEnv;

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
});

/** Landscape plates — pins/events cycle through these so exports / scenery have imagery to reference. */
const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1024",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1024",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1024",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1024",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1024",
  "https://images.unsplash.com/photo-1433838552652-f9a46b332c49?w=1024",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1024",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1024",
];

const PORTRAITS = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=512",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=512",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a6?w=512",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=512",
];

type PinDef = {
  label: string;
  description: string;
  x: number;
  y: number;
};

type EventDef = {
  title: string;
  description: string;
  sequence_order: number;
  pinIndex: number;
  in_world_time: string;
  /** Fake Whisper-style recap so voice/event workflows read alive */
  audio_summary?: string | null;
  /** Narration-first Kokoro routing demo — optional demo silence */
  audio_url?: string | null;
  is_ghost?: boolean;
};

function buildDemoKonvaStage(): Record<string, unknown> {
  return {
    attrs: {
      width: 960,
      height: 600,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    },
    className: "Stage",
    children: [
      {
        className: "Layer",
        attrs: { name: "terrain-sketch" },
        children: [
          {
            className: "Line",
            attrs: {
              id: "demo-coast-ridge",
              points: [40, 120, 140, 90, 260, 110, 380, 70, 520, 100],
              stroke: "#64748b",
              strokeWidth: 4,
              lineCap: "round",
              lineJoin: "round",
              tension: 0.35,
            },
          },
          {
            className: "Line",
            attrs: {
              id: "demo-rift-valley",
              points: [180, 380, 260, 320, 420, 340, 560, 280, 720, 320],
              stroke: "#475569",
              strokeWidth: 3,
              lineCap: "round",
              lineJoin: "round",
              tension: 0.4,
            },
          },
          {
            className: "Line",
            attrs: {
              id: "demo-bridge-span",
              points: [620, 200, 680, 260, 740, 210],
              stroke: "#94a3b8",
              strokeWidth: 3,
              dash: [12, 10],
              lineCap: "round",
            },
          },
          {
            className: "Rect",
            attrs: {
              id: "demo-forge-hotspot",
              x: 720,
              y: 420,
              width: 120,
              height: 72,
              stroke: "#7c3aed",
              strokeWidth: 2,
              cornerRadius: 8,
              opacity: 0.35,
            },
          },
        ],
      },
    ],
  };
}

function buildDemoCanvasState(): Database["public"]["Tables"]["projects"]["Insert"]["canvas_state"] {
  const heroStill = PLACEHOLDER_IMAGES[0];
  const depthStill = PLACEHOLDER_IMAGES[2];
  return {
    stage: buildDemoKonvaStage(),
    meta: {
      scenery_preview_url: heroStill,
      depth_preview_url: depthStill,
      synthesis_user_notes:
        "Demo seed — prioritize obsidian volcanic glass around the Gate; Covenant Hall lit by cold violet flame braziers; forge chimney vents emerald sparks.",
      scenery_pipeline_version: 2,
      scenery_pipeline_stage: "complete",
      scenery_layout_plan_source: "heuristic",
      scenery_transform: {
        x: 36,
        y: 28,
        width: 1024,
        height: 640,
        scaleX: 0.7,
        scaleY: 0.7,
      },
      last_synthesis_at: new Date().toISOString(),
    },
  } as Database["public"]["Tables"]["projects"]["Insert"]["canvas_state"];
}

async function captureSeedSnapshot(projectId: string, description: string) {
  const [{ data: project }, { data: pins }, { data: events }, { data: characters }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("location_pins").select("*").eq("project_id", projectId),
      supabase
        .from("timeline_events")
        .select("*")
        .eq("project_id", projectId)
        .order("sequence_order"),
      supabase.from("characters").select("*").eq("project_id", projectId),
    ]);

  if (!project) return;

  await supabase.from("project_snapshots").insert({
    project_id: projectId,
    change_description: description,
    state_blob: {
      project,
      pins: pins ?? [],
      events: events ?? [],
      characters: characters ?? [],
    },
  });
}

async function main() {
  const existing = await supabase
    .from("projects")
    .select("id")
    .eq("name", DEMO_PROJECT_NAME)
    .maybeSingle();

  if (existing.data?.id) {
    if (!overwrite) {
      console.log("Demo project already exists:", existing.data.id);
      console.log(
        "Set DEMO_OVERWRITE=true to delete and recreate the rich demo dataset.",
      );
      return;
    }
    await supabase.from("projects").delete().eq("id", existing.data.id);
    console.log("Removed previous demo project:", existing.data.id);
  }

  const pinDefs: PinDef[] = [
    {
      label: "Obsidian Gate",
      description:
        "Basalt arch tuned like a tuning fork — oath vibrations shake frost from the pillars.",
      x: 140,
      y: 160,
    },
    {
      label: "Covenant Hall",
      description:
        "Vaulted parliament ring where votes are carved into slate tablets before witnesses.",
      x: 420,
      y: 260,
    },
    {
      label: "Whispering Crypt",
      description:
        "Reliquary maze storing forbidden syllables — airflow carries murmured promises.",
      x: 300,
      y: 440,
    },
    {
      label: "Observatory Spire",
      description:
        "Broken telescope lenses refract auroras into tactical star-charts on the floor.",
      x: 680,
      y: 140,
    },
    {
      label: "Salt Bridge",
      description:
        "Drawbridge of fused halite slabs — crystals sing under siege weapon resonance.",
      x: 640,
      y: 260,
    },
    {
      label: "Hollow Forge",
      description:
        "Forge-heart sunk under cooling magma tubes — smiths temper pact-blades here.",
      x: 780,
      y: 440,
    },
    {
      label: "Ash Approach Road",
      description:
        "Ashen caravan trail threading lava tubes — scouts chalk mirrored compass glyphs.",
      x: 220,
      y: 320,
    },
  ];

  const eventDefs: EventDef[] = [
    {
      title: "The Binding Oath",
      description:
        "Elara Voss kneels beneath the Obsidian Gate while Magister Thorne reads compact clauses aloud; Sister Morwyn witnesses each syllable etched into vapor.",
      sequence_order: 1,
      pinIndex: 0,
      in_world_time: "Nightfall — Year Zero",
      audio_summary:
        "[voice memo] Knight kneeling at gate; magister chanting runic clauses; distant thunder rolls.",
    },
    {
      title: "Council of Echoes",
      description:
        "High seers argue prophecy resonance inside Covenant Hall. Kael Shadowhand slips coded charcoal sketches across the slate floor.",
      sequence_order: 2,
      pinIndex: 1,
      in_world_time: "Midnight vigil",
      audio_summary:
        "[memo] Heated council debate; scratching charcoal diagrams; echoes distort consensus.",
    },
    {
      title: "Secrets in Stone",
      description:
        "Elara traces a glowing sigil inside the Whispering Crypt; Thorne insists they catalog forbidden verbs before sunrise.",
      sequence_order: 3,
      pinIndex: 2,
      in_world_time: "Before dawn",
      audio_summary:
        "[memo] Whispered discoveries underground; librarian insists on linguistic containment.",
    },
    {
      title: "Stars That Bleed Policies",
      description:
        "From the Observatory Spire, Sister Morwyn aligns fractured lenses — politics projected as constellations onto Covenant Hall.",
      sequence_order: 4,
      pinIndex: 3,
      in_world_time: "False dawn aurora",
    },
    {
      title: "Salt Bridge Gambit",
      description:
        "Kael stalls pursuing zealots mid-span while Elara reroutes magma vents below — crystals harmonize into defensive wards.",
      sequence_order: 5,
      pinIndex: 4,
      in_world_time: "Siege hour zero",
      audio_summary:
        "[memo] Combat chatter on bridge; magma hiss beneath decking; crystalline harmonic chord.",
    },
    {
      title: "Forge Benediction",
      description:
        "The Hollow Forge relights — Thorne tempers Elara's oath-blade while Morwyn records blessing frequencies onto wax cylinders.",
      sequence_order: 6,
      pinIndex: 5,
      in_world_time: "Ash sunrise",
    },
    {
      title: "Ash Approach Couriers",
      description:
        "Caravan scouts chalk mirrored glyphs along Ash Approach Road so betrayers cannot spoof compass echoes.",
      sequence_order: 7,
      pinIndex: 6,
      in_world_time: "Morning bell minus two",
    },
    {
      title: "The Pact Fractures",
      description:
        "Elara confronts Kael Shadowhand back at the Obsidian Gate — vows unravel into violet lightning arcs.",
      sequence_order: 8,
      pinIndex: 0,
      in_world_time: "First hostile light",
    },
    {
      title: "Crypt Exodus Clause",
      description:
        "Morwyn evacuates relic syllables through Whispering Crypt ventilation shafts while Thorne stalls insurgents above.",
      sequence_order: 9,
      pinIndex: 2,
      in_world_time: "Mid-morning breach",
    },
    {
      title: "Observatory Ceasefire Draft",
      description:
        "Morwyn broadcasts constellation treaties visible only through Observatory lenses — factions pause bombardment to decode.",
      sequence_order: 10,
      pinIndex: 3,
      in_world_time: "High noon smoke-shadow",
    },
    {
      title: "Ash Road Reinforcement",
      description:
        "Elara reinforces mirrored glyphs while Thorne reroutes lava floods toward Hollow Forge cooling vents.",
      sequence_order: 11,
      pinIndex: 6,
      in_world_time: "Afternoon grit storm",
    },
  ];

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: DEMO_PROJECT_NAME,
      theme: "dark_fantasy",
      aesthetic_style: "oil_painting_cinematic",
      style_config: {
        theme: "dark_fantasy",
        aesthetic_style: "oil_painting_cinematic",
        tone: "moody cinematic opera",
        palette: "obsidian violet / cooled magma amber",
      },
      canvas_state: buildDemoCanvasState(),
    })
    .select()
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Failed to create project");
  }

  await supabase.from("project_members").insert({
    project_id: project.id,
    user_id: ownerId,
    role: "owner",
  });

  const pinIds: string[] = [];
  for (let i = 0; i < pinDefs.length; i++) {
    const p = pinDefs[i];
    const { data: pin, error } = await supabase
      .from("location_pins")
      .insert({
        project_id: project.id,
        label: p.label,
        description: p.description,
        canvas_x: p.x,
        canvas_y: p.y,
        generated_image_url: PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length],
        gen_status: "done",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (pin) pinIds.push(pin.id);
  }

  const characterRows = [
    {
      project_id: project.id,
      name: "Elara Voss",
      role: "primary" as const,
      description:
        "Oath-bound knight-engineer hybrid — carries pact-blades calibrated to harmonic magma vents.",
      visual_traits: {
        hair: "silver under soot",
        build: "athletic tall",
        clothing: "black plate etched with violet conductivity veins",
        features: "arc-burn scar across left brow",
      },
      voice_id: "af_sarah",
      gen_status: "done",
      generated_portrait_url: PORTRAITS[0],
      reference_image_url: PORTRAITS[0],
    },
    {
      project_id: project.id,
      name: "Magister Thorne",
      role: "secondary" as const,
      description:
        "Covenant lexicographer — hears betrayal inside grammatical tense drift.",
      visual_traits: {
        hair: "iron grey braid",
        build: "lean",
        clothing: "layered scholar robes with lantern sigil brooch",
        features: "ink-stained fingertips",
      },
      voice_id: "am_echo",
      gen_status: "done",
      generated_portrait_url: PORTRAITS[1],
      reference_image_url: PORTRAITS[1],
    },
    {
      project_id: project.id,
      name: "Sister Morwyn",
      role: "secondary" as const,
      description:
        "Observatory clergy — translates auroras into diplomatic semaphore glyphs.",
      visual_traits: {
        hair: "braided midnight blue",
        build: "compact",
        clothing: "mirrored ceremonial caul",
        features: "constellation tattoos along cheekbones",
      },
      voice_id: "af_nova",
      gen_status: "done",
      generated_portrait_url: PORTRAITS[2],
      reference_image_url: PORTRAITS[2],
    },
    {
      project_id: project.id,
      name: "Kael Shadowhand",
      role: "secondary" as const,
      description:
        "Covert tactician balancing sabotage ethics against covenant survival odds.",
      visual_traits: {
        hair: "dark cropped",
        build: "wiry",
        clothing: "shadow-weave cloak with salt residue cuffs",
        features: "steel-thread gloves",
      },
      voice_id: "am_michael",
      gen_status: "done",
      generated_portrait_url: PORTRAITS[3],
      reference_image_url: PORTRAITS[3],
    },
  ];

  const { data: insertedCharacters, error: charErr } = await supabase
    .from("characters")
    .insert(characterRows)
    .select("id, name");

  if (charErr || !insertedCharacters?.length) {
    throw new Error(charErr?.message ?? "Failed to seed characters");
  }

  const charIdByName = Object.fromEntries(
    insertedCharacters.map((c) => [c.name, c.id]),
  );

  type InsertedEvent = { id: string; title: string; sequence_order: number };

  const insertedEvents: InsertedEvent[] = [];

  for (const ev of eventDefs) {
    const pinId = pinIds[ev.pinIndex] ?? null;
    const img = PLACEHOLDER_IMAGES[ev.sequence_order % PLACEHOLDER_IMAGES.length];
    const { data: row, error } = await supabase
      .from("timeline_events")
      .insert({
        project_id: project.id,
        title: ev.title,
        description: ev.description,
        sequence_order: ev.sequence_order,
        pin_id: pinId,
        in_world_time: ev.in_world_time,
        audio_summary: ev.audio_summary ?? null,
        audio_url: ev.audio_url ?? null,
        is_ghost: ev.is_ghost ?? false,
        gen_status: "done",
        generated_image_url: img,
      })
      .select("id, title, sequence_order")
      .single();
    if (error) throw new Error(error.message);
    if (row) insertedEvents.push(row);
  }

  /** Narrative-linked cast — Kokoro picks voices via Character Vault names embedded in descriptions */
  const pairings: [string, string][] = [
    ["The Binding Oath", "Elara Voss"],
    ["The Binding Oath", "Magister Thorne"],
    ["The Binding Oath", "Sister Morwyn"],
    ["Council of Echoes", "Kael Shadowhand"],
    ["Council of Echoes", "Magister Thorne"],
    ["Secrets in Stone", "Elara Voss"],
    ["Stars That Bleed Policies", "Sister Morwyn"],
    ["Salt Bridge Gambit", "Kael Shadowhand"],
    ["Salt Bridge Gambit", "Elara Voss"],
    ["Forge Benediction", "Magister Thorne"],
    ["Forge Benediction", "Sister Morwyn"],
    ["The Pact Fractures", "Elara Voss"],
    ["The Pact Fractures", "Kael Shadowhand"],
    ["Crypt Exodus Clause", "Sister Morwyn"],
    ["Observatory Ceasefire Draft", "Sister Morwyn"],
    ["Ash Road Reinforcement", "Elara Voss"],
    ["Ash Road Reinforcement", "Magister Thorne"],
  ];

  const eventIdByTitle = Object.fromEntries(
    insertedEvents.map((e) => [e.title, e.id]),
  );

  const ecRows = pairings
    .map(([title, charName]) => {
      const event_id = eventIdByTitle[title];
      const character_id = charIdByName[charName];
      if (!event_id || !character_id) return null;
      return { event_id, character_id };
    })
    .filter((row): row is { event_id: string; character_id: string } => row !== null);

  if (ecRows.length) {
    const { error: ecErr } = await supabase.from("event_characters").insert(ecRows);
    if (ecErr) throw new Error(ecErr.message);
  }

  /** Ghost Copilot proposal — approve/reject exercises pending workflow */
  const nextGhostOrder =
    insertedEvents.reduce((max, e) => Math.max(max, e.sequence_order), 0) + 1;

  const { data: ghostEvent, error: ghostErr } = await supabase
    .from("timeline_events")
    .insert({
      project_id: project.id,
      title: "Secret passage beneath Covenant Hall (ghost)",
      description:
        "Copilot proposal: Thorne discovers a magma-equalization crawlspace linking Covenant Hall to Salt Bridge foundations — resolves siege continuity.",
      sequence_order: nextGhostOrder,
      pin_id: pinIds[1] ?? null,
      in_world_time: "Interstitial · propose merge before siege hour",
      gen_status: "done",
      generated_image_url: PLACEHOLDER_IMAGES[5],
      is_ghost: true,
      audio_summary: "[ghost draft] echoes of crawling vents + tactical whisper overlay",
    })
    .select("id")
    .single();

  if (ghostErr) throw new Error(ghostErr.message);

  if (ghostEvent?.id) {
    await supabase.from("copilot_pending_changes").insert({
      project_id: project.id,
      change_type: "add_event",
      status: "pending",
      payload: { event_id: ghostEvent.id },
    });
  }

  await supabase.from("agent_logs").insert([
    {
      project_id: project.id,
      query:
        "Timeline audit: how did Thorne vault Salt Bridge wards between Salt Bridge Gambit and Forge Benediction without alerting zealots?",
      response:
        "Introduce an echo-null cloak beat OR confirm Sister Morwyn dampened harmonic alarms via Observatory interference — tie Morwyn into Events 5→6 explicitly.",
      action_taken: false,
    },
    {
      project_id: project.id,
      query:
        "Does Elara contradict herself about magma reroutes across Salt Bridge Gambit vs Ash Road Reinforcement?",
      response:
        "No hard contradiction if magma floods follow discrete faultlines — annotate Hollow Forge schematic note on Event 11 description.",
      action_taken: false,
    },
  ]);

  await captureSeedSnapshot(
    project.id,
    "Demo baseline — Covenant arc + geography sketch + Tier‑B scenery meta",
  );

  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(" Demo project ready:", project.id);
  console.log("══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Try in the workspace:");
  console.log("  • GeographyCanvas — seeded Konva strokes + scenery preview meta");
  console.log("  • Pins ↔ Timeline — seven pins, eleven canon beats + Copilot ghost node");
  console.log("  • Character Vault — four portraits + Kokoro voice presets");
  console.log("  • Export Terminal — storyboard JSON / Kokoro narration / Luma animatic");
  console.log("  • Creative Copilot — seeded plot-hole logs + ghost approval flow");
  console.log("  • History sidebar — revert snapshot captured post-seed");
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
