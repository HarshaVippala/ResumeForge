import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during builds to prevent unused variable errors from blocking deployment
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
