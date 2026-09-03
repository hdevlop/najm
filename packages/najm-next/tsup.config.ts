import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    config: 'src/config.ts',
    configurable: 'src/configurable.ts',
  },
  format: ['esm'],
  target: 'es2022',
  clean: true,
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
  external: ['next'],
  esbuildOptions(options) {
    options.keepNames = true;
  },
});
