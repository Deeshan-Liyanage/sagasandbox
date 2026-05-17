"use client";

import { Separator } from "react-resizable-panels";
import { cn } from "@/lib/cn";

export interface PaneResizeHandleProps {
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Vertical bar between columns (default). Horizontal bar between rows when `horizontal`. */
  direction?: "vertical" | "horizontal";
}

export function PaneResizeHandle({
  id,
  className,
  disabled,
  direction = "vertical",
}: PaneResizeHandleProps) {
  const isVerticalBar = direction === "vertical";
  return (
    <Separator
      id={id}
      disabled={disabled}
      className={cn(
        isVerticalBar
          ? "w-px min-w-1 shrink-0 self-stretch bg-[#2a2a2e]"
          : "h-px min-h-1 w-full shrink-0 bg-[#2a2a2e]",
        disabled &&
          (isVerticalBar
            ? "!w-0 !min-w-0 !max-w-0 shrink-0 border-none bg-transparent p-0 opacity-0"
            : "!h-0 !min-h-0 !max-h-0 shrink-0 border-none bg-transparent p-0 opacity-0"),
        "transition-colors data-[separator]:hover:bg-[#7c3aed] data-[separator]:active:bg-[#7c3aed]",
        "outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40",
        className,
      )}
    />
  );
}
