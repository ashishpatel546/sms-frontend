import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["myrealapp.appme.in", "https://myrealapp.appme.in"],
  reactCompiler: true,
};

export default nextConfig;
