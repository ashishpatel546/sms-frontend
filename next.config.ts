import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'myrealapp.appme.in',
    'https://myrealapp.appme.in',
    '*.appme.in',
  ],
  reactCompiler: false,
};

export default nextConfig;
