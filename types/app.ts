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

export type StyleConfig = {
  aesthetic?: string
  aesthetic_style?: string
  theme?: string
  tone?: string
}
