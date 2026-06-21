import type { NextConfig } from 'next';
import path from 'node:path';

const kitThemeCss = path.resolve(
  __dirname,
  '../../packages/najm-kit/src/theme.css',
);

const nextConfig: NextConfig = {
  env: {
    WS_NO_BUFFER_UTIL: 'true',
    WS_NO_UTF_8_VALIDATE: 'true',
  },
  serverExternalPackages: ['reflect-metadata', 'better-sqlite3'],
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string> | undefined),
      'najm-kit/theme.css$': kitThemeCss,
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      'najm-kit/theme.css': kitThemeCss,
    },
  },
};

export default nextConfig;