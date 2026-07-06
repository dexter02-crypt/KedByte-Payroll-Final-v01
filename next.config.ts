import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  // Disable the dev compilation indicator (bottom-left "Compiling..." badge)
  devIndicators: false,
};

export default nextConfig;
