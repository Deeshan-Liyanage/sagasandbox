"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PANE_VISIBILITY,
  LAYOUT_PRESETS,
  loadPaneVisibility,
  savePaneVisibility,
  type LayoutPresetId,
  type PaneVisibility,
  type WorkspacePaneId,
} from "@/lib/workspace-panes";

export function useWorkspacePanes(projectId: string) {
  // Match SSR markup: read localStorage only after mount — avoids hydration mismatch.
  const [paneVisibility, setPaneVisibility] = useState<PaneVisibility>(() => ({
    ...DEFAULT_PANE_VISIBILITY,
  }));
  const skipNextSave = useRef(false);

  useEffect(() => {
    skipNextSave.current = true;
    const id = requestAnimationFrame(() =>
      setPaneVisibility(loadPaneVisibility(projectId)),
    );
    return () => cancelAnimationFrame(id);
  }, [projectId]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    savePaneVisibility(projectId, paneVisibility);
  }, [projectId, paneVisibility]);

  const togglePane = useCallback((id: WorkspacePaneId) => {
    setPaneVisibility((v) => ({ ...v, [id]: !v[id] }));
  }, []);

  const setPaneVisible = useCallback((id: WorkspacePaneId, visible: boolean) => {
    setPaneVisibility((v) => (v[id] === visible ? v : { ...v, [id]: visible }));
  }, []);

  const applyPreset = useCallback((preset: LayoutPresetId) => {
    setPaneVisibility({ ...LAYOUT_PRESETS[preset] });
  }, []);

  const isPaneVisible = useCallback(
    (id: WorkspacePaneId) => paneVisibility[id],
    [paneVisibility],
  );

  return {
    paneVisibility,
    setPaneVisibility,
    togglePane,
    setPaneVisible,
    applyPreset,
    isPaneVisible,
  };
}