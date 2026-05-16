import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage — generated images from handle-fal-webhook
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // fal.ai CDN — raw output URLs before webhook re-uploads to storage
      {
        protocol: "https",
        hostname: "v3.fal.media",
      },
      {
        protocol: "https",
        hostname: "fal-cdn-public.s3.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
