import type { Database } from "./db"

export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type LocationPin = Database["public"]["Tables"]["location_pins"]["Row"]
export type TimelineEvent = Database["public"]["Tables"]["timeline_events"]["Row"]
export type Character = Database["public"]["Tables"]["characters"]["Row"]
export type Export = Database["public"]["Tables"]["exports"]["Row"]
export type ProjectMember = Database["public"]["Tables"]["project_members"]["Row"]

export type GenStatus = "pending" | "generating" | "done" | "error"
export type ExportType = "storyboard_pdf" | "audio_script"
export type ExportStatus = "queued" | "processing" | "done" | "error"
export type CharacterRole = "primary" | "secondary"

export type VisualTraits = {
  hair?: string
  build?: string
  clothing?: string
  features?: string
}

export type StyleConfig = {
  aesthetic?: string
  aesthetic_style?: string
  theme?: string
  tone?: string
}

const GEN_STATUSES: GenStatus[] = ["pending", "generating", "done", "error"]

export function asGenStatus(value: string | null | undefined): GenStatus {
  if (value && GEN_STATUSES.includes(value as GenStatus)) {
    return value as GenStatus
  }
  return "pending"
}

export function getVisualTraits(
  traits: Character["visual_traits"],
): VisualTraits {
  if (!traits || typeof traits !== "object" || Array.isArray(traits)) {
    return {}
  }
  const t = traits as Record<string, unknown>
  return {
    hair: typeof t.hair === "string" ? t.hair : undefined,
    build: typeof t.build === "string" ? t.build : undefined,
    clothing: typeof t.clothing === "string" ? t.clothing : undefined,
    features: typeof t.features === "string" ? t.features : undefined,
  }
}
