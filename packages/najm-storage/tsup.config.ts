import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioSrcDir = resolve(__dirname, 'src', 'studio');

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
  name: 'najm-storage-studio-alias',
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
  if (result.status !== 0) throw new Error('Failed to build storage studio styles.css');
}

const backend = defineConfig({
  entry: ['src/index.ts', 'src/schema/sqlite.ts', 'src/schema/pg.ts', 'src/schema/mysql.ts'],
  format: ['esm'],
  dts: { compilerOptions: { composite: false, declaration: true, declarationMap: false } },
  splitting: false,
  sourcemap: false,
  clean: false,
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  bundle: true,
  skipNodeModulesBundle: true,
  external: ['diject', 'najm-core', 'najm-event', 'najm-database', 'najm-mcp', 'hono', 'reflect-metadata'],
  esbuildOptions(options) { options.keepNames = true; },
  esbuildPlugins: [{
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
        return { contents: result.outputText, loader: 'js' };
      });
    },
  }],
});

const studio = defineConfig({
  entry: { 'studio/index': 'src/studio/ui.ts' },
  format: ['esm'],
  target: 'es2022',
  clean: false,
  splitting: false,
  treeshake: true,
  sourcemap: false,
  dts: { compilerOptions: { jsx: 'react-jsx' } },
  external: ['@tanstack/react-router', 'react', 'react-dom', 'react/jsx-runtime', 'lucide-react', 'recharts', 'clsx', 'tailwind-merge', 'swr'],
  esbuildPlugins: [studioAliasPlugin],
  outExtension: () => ({ js: '.mjs' }),
  async onSuccess() { buildStyles(); },
});

const client = defineConfig({
  entry: {
    'client/index': 'src/client/index.ts',
    'client-db/index': 'src/client-db/index.ts',
  },
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  clean: false,
  splitting: false,
  treeshake: true,
  sourcemap: false,
  dts: { compilerOptions: { composite: false, declaration: true, declarationMap: false } },
  external: ['@electric-sql/pglite', 'drizzle-orm'],
  outExtension: () => ({ js: '.mjs' }),
});

const configs = { backend, studio, client } as const;
const buildTarget = process.env.NAJM_STORAGE_BUILD_TARGET as keyof typeof configs | undefined;

export default buildTarget && configs[buildTarget]
  ? configs[buildTarget]
  : [backend, studio, client];
