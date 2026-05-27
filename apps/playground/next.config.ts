import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    WS_NO_BUFFER_UTIL: 'true',
    WS_NO_UTF_8_VALIDATE: 'true',
  },
  serverExternalPackages: ['reflect-metadata', 'better-sqlite3', 'sqlite-vec'],
};

export default nextConfig;
