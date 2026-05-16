export type WorkspacePaneId = "vault" | "export" | "timeline";

export type PaneVisibility = Record<WorkspacePaneId, boolean>;

export const DEFAULT_PANE_VISIBILITY: PaneVisibility = {
  vault: true,
  export: false,
  timeline: true,
};

export const LAYOUT_PRESETS = {
  default: {
    vault: true,
    export: false,
    timeline: true,
  },
  "focus-canvas": {
    vault: false,
    export: false,
    timeline: false,
  },
  full: {
    vault: true,
    export: true,
    timeline: true,
  },
} as const satisfies Record<string, PaneVisibility>;

export type LayoutPresetId = keyof typeof LAYOUT_PRESETS;

const visibilityStorageKey = (projectId: string) =>
  `saga-workspace-panes:${projectId}`;

export function loadPaneVisibility(projectId: string): PaneVisibility {
  if (typeof window === "undefined") {
    return { ...DEFAULT_PANE_VISIBILITY };
  }
  try {
    const raw = localStorage.getItem(visibilityStorageKey(projectId));
    if (!raw) return { ...DEFAULT_PANE_VISIBILITY };
    const parsed = JSON.parse(raw) as Partial<PaneVisibility>;
    return { ...DEFAULT_PANE_VISIBILITY, ...parsed };
  } catch {
    return { ...DEFAULT_PANE_VISIBILITY };
  }
}

export function savePaneVisibility(
  projectId: string,
  visibility: PaneVisibility,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      visibilityStorageKey(projectId),
      JSON.stringify(visibility),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function layoutGroupId(
  projectId: string,
  segment: "horizontal" | "vertical",
): string {
  return `saga-workspace-layout:${projectId}:${segment}`;
}
