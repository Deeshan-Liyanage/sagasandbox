// REALTIME CHANNEL SPEC — consumed by Agent C's canvas component

// Channel name: `project:${projectId}` (one channel per project)
//
// Broadcast events (ephemeral, no DB):
//   type: 'canvas_op'
//   payload: {
//     op: 'add' | 'modify' | 'delete' | 'cursor'
//     user_id: string
//     object_id: string
//     payload: object
//   }
//
// Postgres Changes (DB-backed, for gen_status):
//   table: 'location_pins'
//   table: 'timeline_events'
//   table: 'exports'
//   table: 'characters' (portrait gen_status / generated_portrait_url)
//
// CRITICAL: Broadcast ONLY delta ops. Never broadcast full canvas_state JSON.

export const REALTIME_CHANNEL_PREFIX = "project"

export type CanvasOp = "add" | "modify" | "delete" | "cursor"

export type CanvasOpPayload = {
  op: CanvasOp
  user_id: string
  object_id: string
  payload: Record<string, unknown>
}

export function projectChannelName(projectId: string) {
  return `${REALTIME_CHANNEL_PREFIX}:${projectId}`
}
