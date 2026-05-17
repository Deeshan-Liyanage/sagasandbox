/** Per-project advanced canvas mode (prompt preview, future power-user controls). */

const storageKey = (projectId: string) => `saga-canvas-advanced:${projectId}`;

export function loadCanvasAdvancedMode(projectId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (raw === null) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function saveCanvasAdvancedMode(
  projectId: string,
  enabled: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(projectId), enabled ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
