"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LAYOUT_PRESETS,
  loadPaneVisibility,
  savePaneVisibility,
  type LayoutPresetId,
  type PaneVisibility,
  type WorkspacePaneId,
} from "@/lib/workspace-panes";

export function useWorkspacePanes(projectId: string) {
  const [paneVisibility, setPaneVisibility] = useState<PaneVisibility>(() =>
    loadPaneVisibility(projectId),
  );
  const skipNextSave = useRef(false);

  useEffect(() => {
    skipNextSave.current = true;
    queueMicrotask(() => {
      setPaneVisibility(loadPaneVisibility(projectId));
    });
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