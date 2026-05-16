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

/** External/generated URLs (Fal CDN, Supabase Storage) — remotePatterns are configured in next.config.ts. */
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
