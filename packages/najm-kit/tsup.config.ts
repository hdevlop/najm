import { defineConfig } from 'tsup';
import { resolve } from 'node:path';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/next': 'src/adapters/next.tsx',
    'adapters/app': 'src/adapters/app.tsx',
    json: 'src/json/index.ts',
    query: 'src/query/index.ts',
    // Server-safe leaf entries. The root barrel is one module that reaches the
    // whole component library, so importing it from a server component or a
    // route handler resolves react-hook-form under the `react-server`
    // condition, where `Controller` does not exist and the build fails. These
    // two carry no component imports and are what server code should reach for.
    format: 'src/format/index.ts',
    pagination: 'src/lib/pagination.ts',
  },
  format: ['esm'],
  target: 'es2022',
  clean: true,
  // Required, not cosmetic. `adapters/next` and `index` both pull in
  // src/providers, and without splitting each entry bundles its own copy of
  // the module — including its own React context object. A NajmNextUIProvider
  // from the /next entry would then publish to a context that useNajmTheme
  // from the root entry never reads. Splitting gives both entries one shared
  // chunk, so there is one context.
  splitting: true,
  treeshake: true,
  dts: {
    compilerOptions: {
      jsx: 'react-jsx',
      incremental: false,
      ignoreDeprecations: '5.0',
    },
  },
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'next',
    'next/link',
    'next/image',
    'next/navigation',
    'najm-i18n',
    'najm-i18n/react',
    '@tanstack/react-query',
    'lucide-react',
    'react-international-phone',
    'react-international-phone/style.css',
    '@uiw/react-codemirror',
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/language',
    '@codemirror/commands',
    '@codemirror/lang-json',
    '@codemirror/theme-one-dark',
    '@lezer/highlight',
  ],
  outExtension: () => ({ js: '.mjs' }),
  // `adapters/app` is the one entry meant to be imported by a server
  // component — an application's root layout mounts NajmAppProvider directly,
  // and that import is the boundary into the client graph. esbuild strips
  // module-level directives when bundling (it warns about exactly this), so the
  // directive is restored here rather than written in the source.
  //
  // Only this entry. A `"use client"` on the root entry would drag genuinely
  // server-safe exports (cn, the JSON parsers, formatters) into the client
  // graph, and `adapters/next` already works for consumers who draw the
  // boundary in their own file.
  //
  // Done as a post-build step and not a second tsup config: a separate config
  // would emit its own copy of the shared chunks, which is the duplicate-React
  // -context bug that `splitting: true` above exists to prevent.
  async onSuccess() {
    const { readFile, writeFile } = await import('node:fs/promises');
    const target = resolve(__dirname, 'dist/adapters/app.mjs');
    const source = await readFile(target, 'utf8');
    if (!source.startsWith(`'use client'`)) {
      await writeFile(target, `'use client';\n${source}`, 'utf8');
    }
  },
  esbuildPlugins: [
    {
      name: 'alias-plugin',
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => ({
          path: resolve(__dirname, 'src', args.path.slice(2)),
        }));
      },
    },
  ],
});
