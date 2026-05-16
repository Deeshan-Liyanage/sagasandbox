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

/** External/generated URLs (Fal, Supabase storage) — unoptimized until remotePatterns are set. */
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
      unoptimized
      className={cn(className)}
    />
  );
}
