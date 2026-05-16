// TODO: replace with generated types from ./db when Agent B commits types/db.ts

export type GenStatus = "pending" | "generating" | "done" | "error";
export type ExportType = "storyboard_pdf" | "audio_script";
export type ExportStatus = "queued" | "processing" | "done" | "error";
export type CharacterRole = "primary" | "secondary";

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  theme: string;
  aesthetic_style: string;
  style_config: Record<string, string>;
  canvas_state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LocationPin {
  id: string;
  project_id: string;
  label: string;
  canvas_x: number;
  canvas_y: number;
  description: string | null;
  generated_image_url: string | null;
  fal_request_id: string | null;
  gen_status: GenStatus;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  project_id: string;
  pin_id: string | null;
  title: string;
  description: string | null;
  sequence_order: number;
  in_world_time: string | null;
  generated_image_url: string | null;
  audio_url: string | null;
  fal_request_id: string | null;
  gen_status: GenStatus;
  created_at: string;
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  role: CharacterRole | null;
  description: string | null;
  visual_traits: {
    hair?: string;
    build?: string;
    clothing?: string;
    features?: string;
  };
  reference_image_url: string | null;
  generated_portrait_url: string | null;
  voice_id: string | null;
  created_at: string;
}

export interface Export {
  id: string;
  project_id: string;
  type: ExportType;
  event_ids: string[];
  status: ExportStatus;
  output_url: string | null;
  created_at: string;
}
