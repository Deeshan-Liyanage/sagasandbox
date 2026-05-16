import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface WorkspacePaneChromeProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function WorkspacePaneChrome({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: WorkspacePaneChromeProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col bg-[#1a1a1e]",
        className,
      )}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#2a2a2e] px-3">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-[#9ca3af]">
          {title}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>
      <div
        className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", bodyClassName)}
      >
        {children}
      </div>
    </div>
  );
}
