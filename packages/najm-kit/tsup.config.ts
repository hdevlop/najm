import { defineConfig } from 'tsup';
import { resolve } from 'node:path';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/next': 'src/adapters/next.tsx',
    json: 'src/json/index.ts',
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
