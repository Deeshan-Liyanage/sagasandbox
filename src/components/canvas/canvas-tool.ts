/**
 * Canvas interaction tool for the map workspace.
 *
 * - `map`: default. Drag to draw freehand strokes; click empty space to drop a pin.
 * - `eraser`: drag across strokes to remove them.
 * - `scenery`: drag the synthesized backdrop image to reposition / resize it.
 */
export type CanvasTool = "map" | "eraser" | "scenery";
