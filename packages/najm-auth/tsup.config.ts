import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/schema/pg.ts',
    'src/schema/sqlite.ts',
    'src/schema/mysql.ts',
    'src/client/index.ts',
    'src/client/edge.ts',
    'src/client/react/index.ts',
    'src/client/server/index.ts',
  ],
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
  clean: true,
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  bundle: true,
  skipNodeModulesBundle: true,
  external: [
    'diject', 'najm-core', 'najm-params', 'najm-guard', 'najm-cache',
    'hono', 'reflect-metadata', 'ioredis',
    'react', 'react/jsx-runtime', 'next', 'next/server', 'next/headers', 'next/navigation',
  ],
  esbuildOptions(options) {
    options.keepNames = true;
    options.jsx = 'automatic';
  },
  esbuildPlugins: [
    {
      name: 'preserve-metadata',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, async (args) => {
          // Skip client files — they don't use decorators
          if (args.path.includes('/client/') || args.path.includes('\\client\\')) return;

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
  // Prepend 'use client' to the React entry so Next.js App Router treats it
  // as a client boundary. The React components use hooks, so they cannot
  // run in Server Components.
  async onSuccess() {
    const fs = await import('fs');
    const path = await import('path');
    const reactEntry = path.resolve('dist/client/react/index.js');
    if (fs.existsSync(reactEntry)) {
      const original = await fs.promises.readFile(reactEntry, 'utf8');
      if (!original.startsWith('"use client"')) {
        await fs.promises.writeFile(reactEntry, `"use client";\n${original}`);
      }
    }
  },
});
