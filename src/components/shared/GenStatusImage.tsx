"use client";

import { Loader2, RefreshCw } from "lucide-react";
import type { GenStatus } from "@/types/app";
import { cn } from "@/lib/cn";
import { GEN_STATUS_COLORS } from "@/lib/constants";
import { RemoteImage } from "@/components/shared/RemoteImage";

interface GenStatusImageProps {
  status: GenStatus;
  imageUrl: string | null;
  alt: string;
  onRetry?: () => void;
  className?: string;
}

export function GenStatusImage({
  status,
  imageUrl,
  alt,
  onRetry,
  className,
}: GenStatusImageProps) {
  if (status === "done" && imageUrl) {
    return (
      <RemoteImage
        src={imageUrl}
        alt={alt}
        width={640}
        height={360}
        className={cn(
          "aspect-video h-auto w-full rounded-lg object-cover",
          className,
        )}
      />
    );
  }

  if (status === "error") {
    return (
      <div
        className={cn(
          "flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border-2 border-[#ef4444] bg-[#1a1a1e] p-4",
          className,
        )}
      >
        <p className="text-sm text-[#ef4444]">Generation failed</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-md border border-[#2a2a2e] px-2 py-1 text-xs hover:bg-[#252528]"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const label =
    status === "pending"
      ? "Queued…"
      : status === "generating"
        ? "Generating…"
        : "Waiting…";

  return (
    <div
      className={cn(
        "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-[#252528]",
        status === "generating" && "animate-pulse",
        className,
      )}
    >
      <span
        className="absolute inset-0 opacity-20"
        style={{ backgroundColor: GEN_STATUS_COLORS[status] ?? "#7c3aed" }}
      />
      {status === "generating" ? (
        <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
      ) : null}
      <span className="relative z-10 text-xs text-[#9ca3af]">{label}</span>
    </div>
  );
}
