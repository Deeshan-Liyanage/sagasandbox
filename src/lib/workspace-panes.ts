export type WorkspacePaneId = "vault" | "export" | "timeline";

export type PaneVisibility = Record<WorkspacePaneId, boolean>;

/**
 * First visit (no storage key): same as "Focus canvas" — side panes collapsed.
 * Storage key `v2` intentionally ignores legacy `saga-workspace-panes:${id}` so
 * upgrades default everyone back to focus-canvas once.
 */
export const DEFAULT_PANE_VISIBILITY: PaneVisibility = {
  vault: false,
  export: false,
  timeline: false,
};

export const LAYOUT_PRESETS = {
  "focus-canvas": {
    vault: false,
    export: false,
    timeline: false,
  },
  /** Former primary preset: vault + timeline visible, export hidden. */
  balanced: {
    vault: true,
    export: false,
    timeline: true,
  },
  full: {
    vault: true,
    export: true,
    timeline: true,
  },
} as const satisfies Record<string, PaneVisibility>;

export type LayoutPresetId = keyof typeof LAYOUT_PRESETS;

const visibilityStorageKey = (projectId: string) =>
  `saga-workspace-panes:v2:${projectId}`;

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

export function layoutPresetFromVisibility(
  pv: PaneVisibility,
): LayoutPresetId | "custom" {
  if (!pv.vault && !pv.export && !pv.timeline) return "focus-canvas";
  if (pv.vault && !pv.export && pv.timeline) return "balanced";
  if (pv.vault && pv.export && pv.timeline) return "full";
  return "custom";
}

/** Canonical flex percentages synced when pane rails open or close (collapse is 0%). */
export function horizontalLayoutForVisibility(pv: PaneVisibility): {
  vault: number;
  canvas: number;
  export: number;
} {
  const { vault: v, export: x } = pv;
  if (!v && !x) return { vault: 0, canvas: 100, export: 0 };
  if (v && !x) return { vault: 22, canvas: 78, export: 0 };
  if (!v && x) return { vault: 0, canvas: 78, export: 22 };
  return { vault: 16, canvas: 68, export: 16 };
}

export function verticalLayoutForVisibility(pv: PaneVisibility): {
  main: number;
  timeline: number;
} {
  return pv.timeline ? { main: 78, timeline: 22 } : { main: 100, timeline: 0 };
}

export function layoutGroupId(
  projectId: string,
  segment: "horizontal" | "vertical",
): string {
  return `saga-workspace-layout:v3:${projectId}:${segment}`;
}

const RESIZABLE_PANELS_PREFIX = "react-resizable-panels:";

/** Key format must match `useDefaultLayout` / `react-resizable-panels` (id + panel ids, `:`-joined). */
export function resizablePanelsLayoutStorageKey(
  projectId: string,
  segment: "horizontal" | "vertical",
): string {
  const groupId = layoutGroupId(projectId, segment);
  const panelIds =
    segment === "horizontal"
      ? (["vault", "canvas", "export"] as const)
      : (["main", "timeline"] as const);
  return `${RESIZABLE_PANELS_PREFIX}${[groupId, ...panelIds].join(":")}`;
}

type LayoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function noopStorage(): LayoutStorage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function parseNumericLayoutJson(raw: string): Record<string, number> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function horizontalLayoutLooksValid(layout: Record<string, number>): boolean {
  const { vault: v, canvas: c, export: x } = layout;
  if (v === undefined || c === undefined || x === undefined) return false;
  const sum = v + c + x;
  if (Math.abs(sum - 100) > 2) return false;
  // Reject layouts that crush the canvas (common symptom of bad persisted state).
  if (c < 18) return false;
  return true;
}

function verticalLayoutLooksValid(layout: Record<string, number>): boolean {
  const { main: m, timeline: t } = layout;
  if (m === undefined || t === undefined) return false;
  const sum = m + t;
  if (Math.abs(sum - 100) > 2) return false;
  if (m < 28) return false;
  return true;
}

/**
 * Drops corrupted or absurd persisted flex percentages so the next read falls back to
 * panel `defaultSize` values (see `AppShell`).
 */
export function sanitizeWorkspaceResizableLayouts(
  projectId: string,
  storage: LayoutStorage = typeof window === "undefined"
    ? noopStorage()
    : localStorage,
): void {
  const hKey = resizablePanelsLayoutStorageKey(projectId, "horizontal");
  const vKey = resizablePanelsLayoutStorageKey(projectId, "vertical");
  const hRaw = storage.getItem(hKey);
  if (hRaw) {
    const h = parseNumericLayoutJson(hRaw);
    if (!h || !horizontalLayoutLooksValid(h)) storage.removeItem(hKey);
  }
  const vRaw = storage.getItem(vKey);
  if (vRaw) {
    const v = parseNumericLayoutJson(vRaw);
    if (!v || !verticalLayoutLooksValid(v)) storage.removeItem(vKey);
  }
}

/** Wraps storage so the first read clears bad layout keys for this project. */
export function createSanitizingLayoutStorage(
  projectId: string,
  inner: LayoutStorage,
): LayoutStorage {
  let didSanitize = false;
  return {
    getItem: (key: string) => {
      if (!didSanitize) {
        didSanitize = true;
        sanitizeWorkspaceResizableLayouts(projectId, inner);
      }
      return inner.getItem(key);
    },
    setItem: (key: string, value: string) => inner.setItem(key, value),
    removeItem: (key: string) => inner.removeItem(key),
  };
}
