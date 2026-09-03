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
  external: ['next', 'react'],
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
      pwa: 'src/pwa.ts',
    },
  },
  {
    ...shared,
    entry: { pwaReact: 'src/pwaReact.ts' },
    treeshake: false,
  },
]);
