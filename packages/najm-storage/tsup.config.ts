import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/schema/sqlite.ts',
    'src/schema/pg.ts',
    'src/schema/mysql.ts',
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
  external: ['diject', 'najm-core', 'najm-event', 'najm-database', 'najm-mcp', 'hono', 'reflect-metadata'],
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
