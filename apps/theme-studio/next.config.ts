import type { NextConfig } from 'next';
import path from 'node:path';

const kitThemeCss = path.resolve(
  __dirname,
  '../../packages/najm-kit/src/theme.css',
);

// `tsconfig.json` maps `najm-kit` to its source, which is what makes this app a
// live development harness for the kit. That mapping does not follow into
// `node_modules`, so `najm-theme` — consumed as `dist`, exactly as a real
// application consumes it — would resolve `najm-kit` to `dist` and end up with a
// *second* copy of the design context: `NajmDesignProvider` here would publish
// to a context `useNajmDesignEditor()` inside `najm-theme` never reads, and the
// appearance editor would silently do nothing.
//
// Aliasing at the bundler level applies to every issuer, so both sides share one
// copy. `najm-theme` itself is deliberately *not* aliased — resolving it through
// `node_modules` to its built output is the entire point of the managed mode.
const kitSource = path.resolve(__dirname, '../../packages/najm-kit/src');

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
      'najm-kit$': kitSource,
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      'najm-kit/theme.css': kitThemeCss,
      'najm-kit': kitSource,
    },
  },
};

export default nextConfig;