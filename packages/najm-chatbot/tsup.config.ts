import { defineConfig } from 'tsup';

export default defineConfig({
entry: [
    'src/index.ts',
    'src/schema/sqlite.ts',
    'src/schema/pg.ts',
    'src/schema/mysql.ts',
    'src/react/index.ts',
    'src/testing/index.ts',
    'src/rag.ts',
    'src/studio-assistant.ts',
  ],
  format: ['esm'],
  dts: {
    compilerOptions: {
      composite: false,
      declaration: true,
      declarationMap: false,
      skipLibCheck: true,
      types: ['node', 'bun'],
    },
  },
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  bundle: true,
  skipNodeModulesBundle: true,
  external: [
    'najm-core', 'najm-auth', 'najm-cache', 'najm-database', 'najm-event',
    'najm-guard', 'najm-mcp', 'najm-rag', 'najm-validation',
    'reflect-metadata',
    'ai', 'ai/test', '@ai-sdk/anthropic', '@ai-sdk/openai', '@ai-sdk/google',
    '@ai-sdk/react', 'react', 'react/jsx-runtime',
    'lucide-react', 'react-markdown', 'highlight.js',
    'bun:sqlite', 'drizzle-orm/bun-sqlite', 'drizzle-orm',
    'sqlite-vec',
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
          // React subpath has no decorators — skip metadata transform
          if (args.path.includes('/react/') || args.path.includes('\\react\\')) return;

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
    },
  ],
  // Prepend 'use client' to the React entry so Next.js App Router treats it as a client boundary.
  async onSuccess() {
    const fs = await import('fs');
    const path = await import('path');
    const reactEntry = path.resolve('dist/react/index.mjs');
    if (fs.existsSync(reactEntry)) {
      const original = await fs.promises.readFile(reactEntry, 'utf8');
      if (!original.startsWith('"use client"')) {
        await fs.promises.writeFile(reactEntry, `"use client";\n${original}`);
      }
    }
  },
});
