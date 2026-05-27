import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  bundle: true,
  skipNodeModulesBundle: true,
  external: ['najm-core', 'hono', 'reflect-metadata', 'diject'],
  esbuildOptions(options) {
    options.keepNames = true;
  },
});
