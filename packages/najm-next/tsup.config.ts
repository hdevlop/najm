import { resolve } from 'node:path';
import { defineConfig, type Options } from 'tsup';

const shared: Options = {
  format: ['esm'],
  target: 'es2022',
  clean: false,
  splitting: false,
  treeshake: true,
  sourcemap: false,
  bundle: true,
  skipNodeModulesBundle: true,
  dts: {
    compilerOptions: {
      composite: false,
      declaration: true,
      declarationMap: false,
      incremental: false,
    },
  },
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  external: ['next', 'react', 'najm-auth', 'najm-kit', 'najm-theme'],
  esbuildOptions(options) {
    options.keepNames = true;
  },
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
      config: 'src/config.ts',
      configurable: 'src/configurable.ts',
      app: 'src/app.ts',
      'app/server': 'src/app/server.ts',
      'app/next': 'src/app/next.ts',
      'app/react': 'src/app/react.tsx',
      security: 'src/security.ts',
      'security/reports': 'src/security/reports.ts',
      'instrumentation/client': 'src/instrumentation/client.ts',
      'location/server': 'src/location/server.ts',
      pwa: 'src/pwa.ts',
    },
    // esbuild strips module directives while bundling. Restore the client
    // boundary on this leaf only; app/server and the pure app definition must
    // remain server-safe.
    async onSuccess() {
      const { readFile, writeFile } = await import('node:fs/promises');
      const target = resolve(__dirname, 'dist', 'app', 'react.js');
      const source = await readFile(target, 'utf8');
      if (!source.startsWith(`'use client'`)) {
        await writeFile(target, `'use client';\n${source}`, 'utf8');
      }
    },
  },
  {
    ...shared,
    entry: { pwaReact: 'src/pwaReact.ts' },
    treeshake: false,
  },
]);
