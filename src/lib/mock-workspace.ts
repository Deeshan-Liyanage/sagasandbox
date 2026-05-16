import type {
  Character,
  LocationPin,
  Project,
  TimelineEvent,
} from "@/types/app";

export const DEMO_PROJECT_ID = "demo";

const now = "2026-05-16T12:00:00.000Z";

export function getMockProject(id: string): Project {
  return {
    id,
    owner_id: "demo-user",
    name:
      id === DEMO_PROJECT_ID
        ? "Whispering Tavern — Demo Universe"
        : `Project ${id.slice(0, 8)}`,
    theme: "dark_fantasy",
    aesthetic_style: "Oil Painting",
    style_config: { tone: "moody", palette: "twilight" },
    canvas_state: {},
    created_at: now,
    updated_at: now,
  };
}

export function getMockPins(projectId: string): LocationPin[] {
  return [
    {
      id: "pin-tavern",
      project_id: projectId,
      label: "The Whispering Tavern",
      canvas_x: 320,
      canvas_y: 240,
      description: "A dim elven tavern where contracts change hands after midnight.",
      generated_image_url: null,
      fal_request_id: null,
      gen_status: "pending",
      created_at: now,
    },
    {
      id: "pin-gates",
      project_id: projectId,
      label: "North Gate",
      canvas_x: 520,
      canvas_y: 180,
      description: "Locked at midnight per timeline event #2.",
      generated_image_url: null,
      fal_request_id: null,
      gen_status: "pending",
      created_at: now,
    },
  ];
}

export function getMockEvents(projectId: string): TimelineEvent[] {
  return [
    {
      id: "event-contract",
      project_id: projectId,
      pin_id: "pin-tavern",
      title: "The Mysterious Contract",
      description:
        "An elf receives a glowing parchment in the tavern common room.",
      sequence_order: 0,
      in_world_time: "Frame 1 — dusk",
      generated_image_url: null,
      audio_url: null,
      fal_request_id: null,
      gen_status: "pending",
      created_at: now,
    },
    {
      id: "event-gates",
      project_id: projectId,
      pin_id: "pin-gates",
      title: "Gates Sealed",
      description: "City gates are locked; no one enters after midnight.",
      sequence_order: 1,
      in_world_time: "11:45 PM",
      generated_image_url: null,
      audio_url: null,
      fal_request_id: null,
      gen_status: "pending",
      created_at: now,
    },
  ];
}

export function getMockCharacters(projectId: string): Character[] {
  return [
    {
      id: "char-elf",
      project_id: projectId,
      name: "Lyra Moonwhisper",
      role: "primary",
      description: "Wary elven courier drawn to forbidden contracts.",
      visual_traits: {
        hair: "silver",
        build: "slender",
        clothing: "hooded travel cloak",
        features: "luminous eyes",
      },
      reference_image_url: null,
      generated_portrait_url: null,
      fal_request_id: null,
      gen_status: "done",
      voice_id: null,
      created_at: now,
    },
    {
      id: "char-vance",
      project_id: projectId,
      name: "Detective Vance",
      role: "secondary",
      description: "Human investigator tracking parchment forgeries.",
      visual_traits: {
        hair: "dark",
        build: "broad",
        clothing: "trench coat",
        features: "scarred jaw",
      },
      reference_image_url: null,
      generated_portrait_url: null,
      fal_request_id: null,
      gen_status: "pending",
      voice_id: null,
      created_at: now,
    },
  ];
}
