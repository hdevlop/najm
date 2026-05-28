import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, 'src');

function resolveSourceImport(importPath: string) {
  const basePath = resolve(srcDir, importPath.slice(2));
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    basePath,
    resolve(basePath, 'index.ts'),
    resolve(basePath, 'index.tsx'),
    resolve(basePath, 'index.js'),
    resolve(basePath, 'index.jsx'),
  ];

  return candidates.find((candidate) => {
    try {
      return existsSync(candidate) && statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? basePath;
}

const aliasPlugin = {
  name: 'najm-rag-studio-alias',
  setup(build: any) {
    build.onResolve({ filter: /^@\// }, (args: { path: string }) => ({
      path: resolveSourceImport(args.path),
    }));
  },
};

function buildStyles() {
  const result = spawnSync(process.execPath, [resolve(__dirname, 'scripts', 'build-css.mjs')], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error('Failed to build najm-rag-studio styles.css');
  }
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  clean: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  esbuildPlugins: [aliasPlugin],
  dts: {
    compilerOptions: {
      jsx: 'react-jsx',
    },
  },
  external: [
    '@tanstack/react-router',
    '@najm/rag',
    'najm-chatbot/react',
    'lucide-react',
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@uiw/react-codemirror',
    '@codemirror/lang-json',
    '@codemirror/theme-one-dark',
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/language',
    '@codemirror/commands',
    '@lezer/highlight',
  ],
  outExtension() {
    return {
      js: '.mjs',
    };
  },
  async onSuccess() {
    buildStyles();
  },
});
