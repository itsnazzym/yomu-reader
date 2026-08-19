import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project lives inside a monorepo with multiple lockfiles,
  // so pin the Turbopack root to this folder.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
