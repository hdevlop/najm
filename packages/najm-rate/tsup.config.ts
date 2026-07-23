import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      composite: false,
      declaration: true,
      declarationMap: false,
    }
  },
  clean: true,
  sourcemap: false,
  minify: false,
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  external: [
    'najm-core',
    'diject',
    'najm-guard',
    'najm-params',
    'najm-cache',
    'hono',
    'reflect-metadata'
  ],
});
