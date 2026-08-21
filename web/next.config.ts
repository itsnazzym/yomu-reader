import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "i1.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "i2.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "i3.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "i4.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "t.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "t1.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "t2.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "t3.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "t4.nhentai.net", pathname: "/**" },
      { protocol: "https", hostname: "zrocdn.xyz", pathname: "/galleries/**" },
    ],
  },
  // This project lives inside a monorepo with multiple lockfiles,
  // so pin the Turbopack root to this folder.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
