"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadCanvasAdvancedMode,
  saveCanvasAdvancedMode,
} from "@/lib/canvas-advanced-mode";

export function useCanvasAdvancedMode(projectId: string) {
  const [advancedMode, setAdvancedMode] = useState(() =>
    loadCanvasAdvancedMode(projectId),
  );
  const skipNextSave = useRef(false);

  useEffect(() => {
    skipNextSave.current = true;
    queueMicrotask(() => {
      setAdvancedMode(loadCanvasAdvancedMode(projectId));
    });
  }, [projectId]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveCanvasAdvancedMode(projectId, advancedMode);
  }, [projectId, advancedMode]);

  const toggleAdvancedMode = useCallback(() => {
    setAdvancedMode((v) => !v);
  }, []);

  const setAdvancedModeEnabled = useCallback((enabled: boolean) => {
    setAdvancedMode(enabled);
  }, []);

  return {
    advancedMode,
    setAdvancedMode: setAdvancedModeEnabled,
    toggleAdvancedMode,
  };
}
