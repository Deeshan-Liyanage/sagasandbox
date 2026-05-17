"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

interface RemoteImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

/** External/generated URLs — allowlist in next.config.ts (Supabase, fal CDN, Unsplash demos). */
export function RemoteImage({
  src,
  alt,
  width,
  height,
  className,
}: RemoteImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn(className)}
    />
  );
}
