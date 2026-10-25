import { resolve } from 'node:path';
import { defineConfig } from 'tsup';

const clientEntries = ['react', 'shell/navigation', 'shell/link', 'shell/image', 'shell/auth', 'shell/kit'];

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client/index.ts',
    pwa: 'src/pwa.ts',
    react: 'src/react/index.tsx',
    'shell/navigation': 'src/shell/navigation.tsx',
    'shell/link': 'src/shell/link.tsx',
    'shell/image': 'src/shell/image.tsx',
    'shell/auth': 'src/shell/auth.tsx',
    'shell/kit': 'src/shell/kit.tsx',
    server: 'src/server/index.ts',
    pg: 'src/pg.ts',
    worker: 'src/worker.ts',
    build: 'src/build.ts',
    testing: 'src/testing.ts',
  },
  format: ['esm'],
  target: 'es2022',
  clean: false,
  splitting: false,
  treeshake: true,
  sourcemap: false,
  bundle: true,
  skipNodeModulesBundle: true,
  dts: { compilerOptions: { composite: false, declaration: true, declarationMap: false, incremental: false } },
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  // A shell adapter that imports another (link → navigation) shares its module, never a copy.
  external: [/^najm-offline(\/|$)/, /^najm-/, 'react', '@tanstack/react-query', 'drizzle-orm', 'zod', 'fast-idb'],
  esbuildOptions(options) {
    options.keepNames = true;
  },
  // tsconfig paths would inline the source; the published entry is the one module.
  esbuildPlugins: [{ name: 'najm-offline-self', setup(build) {
    build.onResolve({ filter: /^najm-offline\// }, args => ({ path: args.path, external: true }));
  } }],
  // esbuild strips module directives while bundling. Restore the client
  // boundary on the React entries only.
  async onSuccess() {
    const { readFile, writeFile } = await import('node:fs/promises');
    for (const entry of clientEntries) {
      const target = resolve(__dirname, 'dist', `${entry}.js`);
      const source = await readFile(target, 'utf8');
      if (!source.startsWith(`'use client'`)) await writeFile(target, `'use client';\n${source}`, 'utf8');
    }
  },
});
