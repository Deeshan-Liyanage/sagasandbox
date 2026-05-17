"use client";

import { useLayoutEffect, useMemo } from "react";
import {
  Group,
  Panel,
  useDefaultLayout,
  useGroupRef,
  usePanelRef,
} from "react-resizable-panels";
import {
  Download,
  Map,
  Clock,
  Users,
  FileOutput,
} from "lucide-react";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { WorkspacePaneChrome } from "@/components/layout/WorkspacePaneChrome";
import { PaneResizeHandle } from "@/components/layout/PaneResizeHandle";
import { cn } from "@/lib/cn";
import { themeAccent } from "@/lib/constants";
import {
  createSanitizingLayoutStorage,
  horizontalLayoutForVisibility,
  layoutGroupId,
  layoutPresetFromVisibility,
  verticalLayoutForVisibility,
  type LayoutPresetId,
  type PaneVisibility,
  type WorkspacePaneId,
} from "@/lib/workspace-panes";

type LayoutPersistence = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

function safeLayoutStorage(): LayoutPersistence {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return localStorage;
}

export interface AppShellProps {
  projectId: string;
  projectName: string;
  theme: string;
  paneVisibility: PaneVisibility;
  onTogglePane: (id: WorkspacePaneId) => void;
  onApplyLayoutPreset: (preset: LayoutPresetId) => void;
  canvasContent: ReactNode;
  timelineContent: ReactNode;
  vaultContent: ReactNode;
  exportContent: ReactNode;
  headerActions?: ReactNode;
  onExportClick?: () => void;
}

const RAIL_ICONS = {
  canvas: Map,
  timeline: Clock,
  vault: Users,
  export: FileOutput,
} as const;

export function AppShell({
  projectId,
  projectName,
  theme,
  paneVisibility,
  onTogglePane,
  onApplyLayoutPreset,
  canvasContent,
  timelineContent,
  vaultContent,
  exportContent,
  headerActions,
  onExportClick,
}: AppShellProps) {
  const focusCanvasActive =
    !paneVisibility.vault &&
    !paneVisibility.export &&
    !paneVisibility.timeline;
  const accent = themeAccent(theme);
  const storage = useMemo(() => {
    const inner = safeLayoutStorage();
    if (typeof window === "undefined") return inner;
    return createSanitizingLayoutStorage(projectId, inner);
  }, [projectId]);

  const horizontalLayout = useDefaultLayout({
    id: layoutGroupId(projectId, "horizontal"),
    storage,
    panelIds: ["vault", "canvas", "export"],
  });

  const verticalLayout = useDefaultLayout({
    id: layoutGroupId(projectId, "vertical"),
    storage,
    panelIds: ["main", "timeline"],
  });

  const vaultPanelRef = usePanelRef();
  const exportPanelRef = usePanelRef();
  const timelinePanelRef = usePanelRef();
  const horizontalGroupRef = useGroupRef();
  const verticalGroupRef = useGroupRef();

  const layoutPresetSelected = layoutPresetFromVisibility(paneVisibility);

  useLayoutEffect(() => {
    vaultPanelRef.current?.[paneVisibility.vault ? "expand" : "collapse"]();
    exportPanelRef.current?.[paneVisibility.export ? "expand" : "collapse"]();
    timelinePanelRef.current?.[
      paneVisibility.timeline ? "expand" : "collapse"
    ]();

    horizontalGroupRef.current?.setLayout(
      horizontalLayoutForVisibility(paneVisibility),
    );
    verticalGroupRef.current?.setLayout(
      verticalLayoutForVisibility(paneVisibility),
    );
  }, [
    projectId,
    paneVisibility,
    vaultPanelRef,
    exportPanelRef,
    timelinePanelRef,
    horizontalGroupRef,
    verticalGroupRef,
  ]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0e0e0f] text-[#e5e7eb]">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#2a2a2e] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {projectName}
          </h1>
          <span
            className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide"
            style={{
              borderColor: accent,
              color: accent,
            }}
          >
            {theme.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="workspace-layout-preset">
            Workspace layout
          </label>
          <select
            id="workspace-layout-preset"
            value={
              layoutPresetSelected === "custom"
                ? "custom"
                : layoutPresetSelected
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") return;
              onApplyLayoutPreset(v as LayoutPresetId);
            }}
            className="rounded-md border border-[#2a2a2e] bg-[#1a1a1e] px-2 py-1.5 text-xs font-medium text-[#e5e7eb] outline-none hover:border-[#7c3aed]/50 focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40"
          >
            <option value="focus-canvas">Focus canvas</option>
            <option value="balanced">Balanced</option>
            <option value="full">Full workspace</option>
            <option value="custom" disabled>
              Custom (adjust rail icons)
            </option>
          </select>
          {headerActions}
          <LogoutButton iconOnly />
          <button
            type="button"
            onClick={onExportClick}
            className="inline-flex items-center gap-2 rounded-md border border-[#2a2a2e] bg-[#1a1a1e] px-3 py-1.5 text-sm font-medium transition hover:border-[#7c3aed] hover:text-white"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-[#2a2a2e] bg-[#141416] py-2"
          aria-label="Workspace panes"
        >
          <RailIconButton
            label="Focus canvas"
            icon={RAIL_ICONS.canvas}
            active={focusCanvasActive}
            onClick={() => onApplyLayoutPreset("focus-canvas")}
          />
          <RailIconButton
            label="Toggle timeline"
            icon={RAIL_ICONS.timeline}
            active={paneVisibility.timeline}
            onClick={() => onTogglePane("timeline")}
          />
          <RailIconButton
            label="Toggle vault"
            icon={RAIL_ICONS.vault}
            active={paneVisibility.vault}
            onClick={() => onTogglePane("vault")}
          />
          <RailIconButton
            label="Toggle export"
            icon={RAIL_ICONS.export}
            active={paneVisibility.export}
            onClick={() => onTogglePane("export")}
          />
        </nav>

        <Group
          id={layoutGroupId(projectId, "vertical")}
          groupRef={verticalGroupRef}
          orientation="vertical"
          className="min-h-0 min-w-0 flex-1"
          defaultLayout={verticalLayout.defaultLayout}
          onLayoutChanged={verticalLayout.onLayoutChanged}
        >
          <Panel
            id="main"
            className="min-h-0 min-w-0"
            defaultSize={78}
            minSize={35}
          >
            <Group
              id={layoutGroupId(projectId, "horizontal")}
              groupRef={horizontalGroupRef}
              orientation="horizontal"
              className="h-full min-h-0"
              defaultLayout={horizontalLayout.defaultLayout}
              onLayoutChanged={horizontalLayout.onLayoutChanged}
            >
              <Panel
                id="vault"
                panelRef={vaultPanelRef}
                className="min-h-0 min-w-0"
                collapsible
                collapsedSize={0}
                minSize={12}
                defaultSize={16}
              >
                <WorkspacePaneChrome title="Character vault" bodyClassName="overflow-y-auto">
                  {vaultContent}
                </WorkspacePaneChrome>
              </Panel>
              <PaneResizeHandle
                direction="vertical"
                disabled={!paneVisibility.vault}
              />
              <Panel
                id="canvas"
                className="min-h-0 min-w-0"
                defaultSize={68}
                minSize={28}
              >
                <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#0f0f12]">
                  {canvasContent}
                </div>
              </Panel>
              <PaneResizeHandle
                direction="vertical"
                disabled={!paneVisibility.export}
              />
              <Panel
                id="export"
                panelRef={exportPanelRef}
                className="min-h-0 min-w-0"
                collapsible
                collapsedSize={0}
                minSize={12}
                defaultSize={16}
              >
                <WorkspacePaneChrome title="Export" bodyClassName="overflow-y-auto">
                  {exportContent}
                </WorkspacePaneChrome>
              </Panel>
            </Group>
          </Panel>

          <PaneResizeHandle direction="horizontal" disabled={!paneVisibility.timeline} />

          <Panel
            id="timeline"
            panelRef={timelinePanelRef}
            className="min-h-0 min-w-0"
            collapsible
            collapsedSize={0}
            minSize={14}
            defaultSize={22}
          >
            <WorkspacePaneChrome
              title="Timeline"
              bodyClassName="overflow-hidden"
            >
              {timelineContent}
            </WorkspacePaneChrome>
          </Panel>
        </Group>
      </div>
    </div>
  );
}

function RailIconButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: (typeof RAIL_ICONS)[keyof typeof RAIL_ICONS];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-[#9ca3af] transition hover:bg-[#252528] hover:text-[#e5e7eb]",
        active &&
          "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
    </button>
  );
}

