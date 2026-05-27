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
    basePath,
    resolve(basePath, 'index.ts'),
    resolve(basePath, 'index.tsx'),
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
  name: 'najm-storage-studio-alias',
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
    throw new Error('Failed to build najm-storage-studio styles.css');
  }
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  clean: true,
  splitting: false,
  treeshake: true,
  sourcemap: false,
  dts: {
    compilerOptions: {
      jsx: 'react-jsx',
    },
  },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react', 'recharts', 'clsx', 'tailwind-merge', 'swr'],
  esbuildPlugins: [aliasPlugin],
  outExtension: () => ({ js: '.mjs' }),
  async onSuccess() {
    buildStyles();
  },
});
