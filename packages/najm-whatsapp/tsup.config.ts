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
    `${basePath}.ts`, `${basePath}.tsx`, `${basePath}.js`, `${basePath}.jsx`,
    basePath, resolve(basePath, 'index.ts'), resolve(basePath, 'index.tsx'),
    resolve(basePath, 'index.js'), resolve(basePath, 'index.jsx'),
  ];
  return candidates.find((candidate) => {
    try { return existsSync(candidate) && statSync(candidate).isFile(); }
    catch { return false; }
  }) ?? basePath;
}

const studioAliasPlugin = {
  name: 'najm-whatsapp-studio-alias',
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
  if (result.status !== 0) throw new Error('Failed to build whatsapp studio styles.css');
}

const backend = defineConfig({
  entry: ['src/index.ts', 'src/schema/sqlite.ts', 'src/schema/pg.ts', 'src/schema/mysql.ts'],
  format: ['esm'],
  dts: { compilerOptions: { composite: false, declaration: true, declarationMap: false, skipLibCheck: true } },
  splitting: false,
  sourcemap: false,
  clean: false,
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  bundle: true,
  skipNodeModulesBundle: true,
  external: ['najm-core', 'najm-auth', 'najm-cache', 'najm-event', 'najm-rate', 'najm-guard', 'najm-database', 'hono', 'reflect-metadata'],
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
  sourcemap: false,
  splitting: false,
  treeshake: true,
  esbuildPlugins: [studioAliasPlugin],
  dts: { compilerOptions: { jsx: 'react-jsx' } },
  external: ['@tanstack/react-router', 'lucide-react', 'react', 'react-dom', 'react/jsx-runtime', 'qrcode.react'],
  outExtension() { return { js: '.mjs' }; },
  async onSuccess() { buildStyles(); },
});

const buildTarget = process.env.NAJM_WHATSAPP_BUILD_TARGET;

export default buildTarget === 'backend'
  ? backend
  : buildTarget === 'studio'
    ? studio
    : [backend, studio];
