import type {
  Character,
  LocationPin,
  Project,
  TimelineEvent,
} from "@/types/app";
import type { Json } from "../../types/db";

/** Navigate to `/projects/demo` when Supabase is unset — mirrors seeded “Obsidian Covenant” arc offline */
export const DEMO_PROJECT_ID = "demo";

const now = "2026-05-17T12:00:00.000Z";

const PLATES = [
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1024",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1024",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1024",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1024",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1024",
  "https://images.unsplash.com/photo-1433838552652-f9a46b332c49?w=1024",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1024",
];

const PORTRAITS = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=512",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=512",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a6?w=512",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=512",
];

function demoKonvaStage(): Record<string, unknown> {
  return {
    attrs: { width: 960, height: 600, scaleX: 1, scaleY: 1, x: 0, y: 0 },
    className: "Stage",
    children: [
      {
        className: "Layer",
        attrs: { name: "terrain-sketch" },
        children: [
          {
            className: "Line",
            attrs: {
              id: "mock-coast-ridge",
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
              id: "mock-rift-valley",
              points: [180, 380, 260, 320, 420, 340, 560, 280, 720, 320],
              stroke: "#475569",
              strokeWidth: 3,
              lineCap: "round",
              lineJoin: "round",
              tension: 0.4,
            },
          },
          {
            className: "Rect",
            attrs: {
              id: "mock-forge-hotspot",
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

function demoCanvasState(): Record<string, unknown> {
  return {
    stage: demoKonvaStage(),
    meta: {
      scenery_preview_url: PLATES[0],
      depth_preview_url: PLATES[2],
      synthesis_user_notes:
        "Offline demo — obsidian cliffs at the Gate; Covenant Hall violet braziers.",
      scenery_pipeline_version: 2,
      scenery_pipeline_stage: "complete",
      scenery_transform: {
        x: 36,
        y: 28,
        width: 1024,
        height: 640,
        scaleX: 0.7,
        scaleY: 0.7,
      },
      last_synthesis_at: now,
    },
  };
}

export function getMockProject(id: string): Project {
  if (id === DEMO_PROJECT_ID) {
    return {
      id,
      owner_id: "demo-user",
      name: "The Obsidian Covenant — Offline Demo",
      theme: "dark_fantasy",
      aesthetic_style: "oil_painting_cinematic",
      style_config: {
        tone: "moody cinematic opera",
        palette: "obsidian violet / cooled magma amber",
        theme: "dark_fantasy",
        aesthetic_style: "oil_painting_cinematic",
      },
      canvas_state: demoCanvasState() as Json,
      created_at: now,
      updated_at: now,
    };
  }

  return {
    id,
    owner_id: "demo-user",
    name: `Project ${id.slice(0, 8)}`,
    theme: "dark_fantasy",
    aesthetic_style: "oil_painting_cinematic",
    style_config: { tone: "moody", palette: "twilight" },
    canvas_state: {},
    created_at: now,
    updated_at: now,
  };
}

export function getMockPins(projectId: string): LocationPin[] {
  if (projectId !== DEMO_PROJECT_ID) return [];

  const pins: LocationPin[] = [
    {
      id: "pin-obsidian-gate",
      project_id: projectId,
      created_at: now,
      label: "Obsidian Gate",
      canvas_x: 140,
      canvas_y: 160,
      description:
        "Basalt arch tuned like a tuning fork — oath vibrations shake frost from the pillars.",
      generated_image_url: PLATES[0],
      fal_request_id: null,
      gen_status: "done",
    },
    {
      id: "pin-covenant-hall",
      project_id: projectId,
      created_at: now,
      label: "Covenant Hall",
      canvas_x: 420,
      canvas_y: 260,
      description: "Vaulted parliament ring carved with living witness clauses.",
      generated_image_url: PLATES[1],
      fal_request_id: null,
      gen_status: "done",
    },
    {
      id: "pin-whispering-crypt",
      project_id: projectId,
      created_at: now,
      label: "Whispering Crypt",
      canvas_x: 300,
      canvas_y: 440,
      description: "Reliquary maze storing forbidden syllables.",
      generated_image_url: PLATES[2],
      fal_request_id: null,
      gen_status: "done",
    },
    {
      id: "pin-observatory-spire",
      project_id: projectId,
      created_at: now,
      label: "Observatory Spire",
      canvas_x: 680,
      canvas_y: 140,
      description: "Broken telescope lenses refract auroras into tactical charts.",
      generated_image_url: PLATES[3],
      fal_request_id: null,
      gen_status: "done",
    },
    {
      id: "pin-salt-bridge",
      project_id: projectId,
      created_at: now,
      label: "Salt Bridge",
      canvas_x: 640,
      canvas_y: 260,
      description: "Halite drawbridge that sings under siege resonance.",
      generated_image_url: PLATES[4],
      fal_request_id: null,
      gen_status: "done",
    },
    {
      id: "pin-hollow-forge",
      project_id: projectId,
      created_at: now,
      label: "Hollow Forge",
      canvas_x: 780,
      canvas_y: 440,
      description: "Forge-heart beneath magma tubes — pact-blades tempered here.",
      generated_image_url: PLATES[5],
      fal_request_id: null,
      gen_status: "done",
    },
    {
      id: "pin-ash-road",
      project_id: projectId,
      created_at: now,
      label: "Ash Approach Road",
      canvas_x: 220,
      canvas_y: 320,
      description: "Ashen caravan trail with mirrored compass glyphs.",
      generated_image_url: PLATES[6],
      fal_request_id: null,
      gen_status: "done",
    },
  ];

  return pins;
}

export function getMockEvents(projectId: string): TimelineEvent[] {
  if (projectId !== DEMO_PROJECT_ID) return [];

  const events: TimelineEvent[] = [
    {
      id: "evt-binding-oath",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-obsidian-gate",
      title: "The Binding Oath",
      description:
        "Elara Voss kneels beneath the Obsidian Gate while Magister Thorne reads compact clauses aloud; Sister Morwyn witnesses each syllable etched into vapor.",
      sequence_order: 1,
      in_world_time: "Nightfall — Year Zero",
      generated_image_url: PLATES[0],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary:
        "[voice memo] Knight kneeling at gate; magister chanting runic clauses.",
    },
    {
      id: "evt-council-echoes",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-covenant-hall",
      title: "Council of Echoes",
      description:
        "High seers argue prophecy resonance inside Covenant Hall. Kael Shadowhand slips coded charcoal sketches across the slate floor.",
      sequence_order: 2,
      in_world_time: "Midnight vigil",
      generated_image_url: PLATES[1],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary:
        "[memo] Heated council debate; scratching charcoal diagrams.",
    },
    {
      id: "evt-secrets-stone",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-whispering-crypt",
      title: "Secrets in Stone",
      description:
        "Elara traces a glowing sigil inside the Whispering Crypt; Thorne insists they catalog forbidden verbs before sunrise.",
      sequence_order: 3,
      in_world_time: "Before dawn",
      generated_image_url: PLATES[2],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary:
        "[memo] Whispered discoveries underground; librarian insists on containment.",
    },
    {
      id: "evt-stars-policies",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-observatory-spire",
      title: "Stars That Bleed Policies",
      description:
        "Sister Morwyn aligns fractured lenses — politics projected as constellations onto Covenant Hall.",
      sequence_order: 4,
      in_world_time: "False dawn aurora",
      generated_image_url: PLATES[3],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary: null,
    },
    {
      id: "evt-salt-gambit",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-salt-bridge",
      title: "Salt Bridge Gambit",
      description:
        "Kael stalls pursuing zealots mid-span while Elara reroutes magma vents below — crystals harmonize into defensive wards.",
      sequence_order: 5,
      in_world_time: "Siege hour zero",
      generated_image_url: PLATES[4],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary:
        "[memo] Combat chatter on bridge; magma hiss beneath decking.",
    },
    {
      id: "evt-forge-benediction",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-hollow-forge",
      title: "Forge Benediction",
      description:
        "The Hollow Forge relights — Thorne tempers Elara's oath-blade while Morwyn records blessing frequencies.",
      sequence_order: 6,
      in_world_time: "Ash sunrise",
      generated_image_url: PLATES[5],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary: null,
    },
    {
      id: "evt-ash-couriers",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-ash-road",
      title: "Ash Approach Couriers",
      description:
        "Caravan scouts chalk mirrored glyphs along Ash Approach Road so betrayers cannot spoof compass echoes.",
      sequence_order: 7,
      in_world_time: "Morning bell minus two",
      generated_image_url: PLATES[6],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary: null,
    },
    {
      id: "evt-pact-fractures",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-obsidian-gate",
      title: "The Pact Fractures",
      description:
        "Elara confronts Kael Shadowhand back at the Obsidian Gate — vows unravel into violet lightning arcs.",
      sequence_order: 8,
      in_world_time: "First hostile light",
      generated_image_url: PLATES[0],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary: null,
    },
    {
      id: "evt-crypt-exodus",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-whispering-crypt",
      title: "Crypt Exodus Clause",
      description:
        "Morwyn evacuates relic syllables through ventilation shafts while Thorne stalls insurgents above.",
      sequence_order: 9,
      in_world_time: "Mid-morning breach",
      generated_image_url: PLATES[2],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary: null,
    },
    {
      id: "evt-ceasefire-draft",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-observatory-spire",
      title: "Observatory Ceasefire Draft",
      description:
        "Morwyn broadcasts constellation treaties visible only through Observatory lenses.",
      sequence_order: 10,
      in_world_time: "High noon smoke-shadow",
      generated_image_url: PLATES[3],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary: null,
    },
    {
      id: "evt-ash-reinforce",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-ash-road",
      title: "Ash Road Reinforcement",
      description:
        "Elara reinforces mirrored glyphs while Thorne reroutes lava floods toward Hollow Forge cooling vents.",
      sequence_order: 11,
      in_world_time: "Afternoon grit storm",
      generated_image_url: PLATES[6],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: false,
      audio_summary: null,
    },
    {
      id: "evt-ghost-passage",
      project_id: projectId,
      created_at: now,
      pin_id: "pin-covenant-hall",
      title: "Secret passage beneath Covenant Hall (ghost)",
      description:
        "Copilot proposal: Thorne discovers a magma-equalization crawlspace linking Covenant Hall to Salt Bridge foundations.",
      sequence_order: 12,
      in_world_time: "Interstitial · awaiting approval",
      generated_image_url: PLATES[5],
      audio_url: null,
      fal_request_id: null,
      gen_status: "done",
      is_ghost: true,
      audio_summary:
        "[ghost draft] echoes of crawling vents + tactical whisper overlay",
    },
  ];

  return events;
}

export function getMockCharacters(projectId: string): Character[] {
  if (projectId !== DEMO_PROJECT_ID) return [];

  const chars: Character[] = [
    {
      id: "char-elara-voss",
      project_id: projectId,
      created_at: now,
      name: "Elara Voss",
      role: "primary",
      description:
        "Oath-bound knight-engineer hybrid — pact-blades calibrated to harmonic magma vents.",
      visual_traits: {
        hair: "silver under soot",
        build: "athletic tall",
        clothing: "black plate etched with violet conductivity veins",
        features: "arc-burn scar across left brow",
      },
      reference_image_url: PORTRAITS[0],
      generated_portrait_url: PORTRAITS[0],
      fal_request_id: null,
      gen_status: "done",
      voice_id: "af_sarah",
    },
    {
      id: "char-thorne",
      project_id: projectId,
      created_at: now,
      name: "Magister Thorne",
      role: "secondary",
      description:
        "Covenant lexicographer — hears betrayal inside grammatical tense drift.",
      visual_traits: {
        hair: "iron grey braid",
        build: "lean",
        clothing: "layered scholar robes with lantern sigil brooch",
        features: "ink-stained fingertips",
      },
      reference_image_url: PORTRAITS[1],
      generated_portrait_url: PORTRAITS[1],
      fal_request_id: null,
      gen_status: "done",
      voice_id: "am_echo",
    },
    {
      id: "char-morwyn",
      project_id: projectId,
      created_at: now,
      name: "Sister Morwyn",
      role: "secondary",
      description:
        "Observatory clergy — translates auroras into diplomatic semaphore glyphs.",
      visual_traits: {
        hair: "braided midnight blue",
        build: "compact",
        clothing: "mirrored ceremonial caul",
        features: "constellation tattoos along cheekbones",
      },
      reference_image_url: PORTRAITS[2],
      generated_portrait_url: PORTRAITS[2],
      fal_request_id: null,
      gen_status: "done",
      voice_id: "af_nova",
    },
    {
      id: "char-kael",
      project_id: projectId,
      created_at: now,
      name: "Kael Shadowhand",
      role: "secondary",
      description:
        "Covert tactician balancing sabotage ethics against covenant survival odds.",
      visual_traits: {
        hair: "dark cropped",
        build: "wiry",
        clothing: "shadow-weave cloak with salt residue cuffs",
        features: "steel-thread gloves",
      },
      reference_image_url: PORTRAITS[3],
      generated_portrait_url: PORTRAITS[3],
      fal_request_id: null,
      gen_status: "done",
      voice_id: "am_michael",
    },
  ];

  return chars;
}
