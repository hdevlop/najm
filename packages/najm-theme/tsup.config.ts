import { defineConfig } from 'tsup';

/**
 * One package, several runtimes.
 *
 * `splitting` stays off on purpose. Shared chunks are what would let a client
 * bundle reach a controller: the moment `react/index` and `server/index` both
 * import a contract, a split build gives them one chunk, and anything else that
 * chunk drags in travels with it. Off, every entry carries its own copy of the
 * pure modules it uses — a few duplicated kilobytes of validation in exchange
 * for an export map that means what it says. Nothing here holds module state
 * (no React context, no registry), so a second copy has no identity to lose.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'contracts/index': 'src/contracts/index.ts',
    'server/index': 'src/server/index.ts',
    // The RSC adapter and the guard the `browser` condition resolves instead,
    // so a Client Component importing it fails at build time rather than
    // pulling a server module into the browser graph.
    'server/react': 'src/server/react.ts',
    'server/reactClientGuard': 'src/server/reactClientGuard.ts',
    'schema/pg': 'src/schema/pg.ts',
    'schema/sqlite': 'src/schema/sqlite.ts',
    'react/index': 'src/react/index.ts',
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
      jsx: 'react-jsx',
      incremental: false,
    },
  },
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  external: [
    'diject',
    'drizzle-orm',
    'drizzle-orm/pg-core',
    'drizzle-orm/sqlite-core',
    'hono',
    'najm-core',
    'najm-database',
    'najm-event',
    'najm-i18n',
    'najm-kit',
    'najm-kit/server',
    'najm-kit/server/react',
    'najm-mcp',
    'najm-storage',
    'najm-validation',
    'next',
    'next/navigation',
    'react',
    'react-dom',
    'react/jsx-runtime',
    'reflect-metadata',
    'sharp',
    '@tanstack/react-query',
    'lucide-react',
    'zod',
  ],
  esbuildOptions(options) {
    options.keepNames = true;
    options.jsx = 'automatic';
  },
  esbuildPlugins: [
    {
      // esbuild drops `emitDecoratorMetadata`, and the Najm container reads
      // that metadata to resolve constructor injections. Server sources go
      // through the TypeScript transpiler first so the `design:paramtypes`
      // emit survives; nothing outside `src/server` is decorated.
      name: 'preserve-metadata',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
          const path = args.path.replace(/\\/g, '/');
          if (!path.includes('/src/server/')) return;

          const ts = await import('typescript');
          const fs = await import('node:fs');

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
    },
  ],
  // esbuild strips module-level directives when bundling, so the client
  // boundary is restored here rather than authored in the source. Only the
  // React entry gets it: `contracts` is imported by server code too, and a
  // `"use client"` there would drag validation into the client graph.
  async onSuccess() {
    const { readFile, writeFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');

    const target = resolve(__dirname, 'dist/react/index.js');
    const source = await readFile(target, 'utf8');
    if (!source.startsWith('"use client"')) {
      await writeFile(target, `"use client";\n${source}`, 'utf8');
    }
  },
});
