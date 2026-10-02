import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioSrcDir = resolve(__dirname, 'src', 'studio-ui');

function resolveStudioImport(importPath: string) {
  const basePath = resolve(studioSrcDir, importPath.slice(2));
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    basePath,
    resolve(basePath, 'index.ts'),
    resolve(basePath, 'index.tsx'),
  ];
  return candidates.find((candidate) => {
    try { return existsSync(candidate) && statSync(candidate).isFile(); }
    catch { return false; }
  }) ?? basePath;
}

const studioAliasPlugin = {
  name: 'najm-rag-studio-alias',
  setup(build: any) {
    build.onResolve({ filter: /^@\// }, (args: { path: string }) => ({
      path: resolveStudioImport(args.path),
    }));
  },
};

function buildStyles() {
  const result = spawnSync(process.execPath, [resolve(__dirname, 'scripts', 'build-css.mjs')], {
    cwd: __dirname, stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Failed to build RAG Studio styles.css');
}

const backend = defineConfig({
  tsconfig: 'tsconfig.build.json',
  entry: {
    'index': 'src/index.ts',
    'studio-contract': 'src/studioContract/index.ts',
    'schema/sqlite': 'src/schema/sqlite.ts',
    'schema/pg': 'src/schema/pg.ts',
    'schema/mysql': 'src/schema/mysql.ts',
  },
  format: ['esm'],
  dts: {
    compilerOptions: {
      composite: false,
      declaration: true,
      declarationMap: false,
    }
  },
  splitting: false,
  sourcemap: false,
  clean: false,
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  bundle: true,
  skipNodeModulesBundle: true,
  external: ['reflect-metadata'],
  esbuildOptions(options) {
    options.keepNames = true;
  },
  esbuildPlugins: [
    {
      name: 'preserve-metadata',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
          const ts = await import('typescript');
          const fs = await import('fs');
          const source = await fs.promises.readFile(args.path, 'utf8');
          const result = ts.transpileModule(source, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.ESNext,
              experimentalDecorators: true,
              emitDecoratorMetadata: true,
              moduleResolution: ts.ModuleResolutionKind.Bundler,
            },
          });
          return {
            contents: result.outputText,
            loader: 'js',
          };
        });
      },
    },
  ],
});

// The Studio UI is a browser-only React bundle. Dependencies and peers stay
// external (tsup default), so the host app shares one React and one najm-kit.
const studio = defineConfig({
  tsconfig: 'tsconfig.build.json',
  entry: { 'studio/index': 'src/studio-ui/ui.ts' },
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  clean: false,
  splitting: false,
  // esbuild already tree-shakes the bundle; tsup's extra Rollup pass would
  // strip the 'use client' banner that Next server components rely on.
  treeshake: false,
  sourcemap: false,
  outDir: 'dist',
  dts: { compilerOptions: { jsx: 'react-jsx', composite: false, declarationMap: false } },
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  banner: { js: "'use client';" },
  esbuildPlugins: [studioAliasPlugin],
  outExtension: () => ({ js: '.mjs' }),
  async onSuccess() { buildStyles(); },
});

const configs = { backend, studio } as const;
const buildTarget = process.env.NAJM_RAG_BUILD_TARGET as keyof typeof configs | undefined;

export default buildTarget && configs[buildTarget]
  ? configs[buildTarget]
  : [backend, studio];
