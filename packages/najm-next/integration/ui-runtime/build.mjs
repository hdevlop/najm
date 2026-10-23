import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = import.meta.dir;
await mkdir(resolve(root, '.output'), { recursive: true });
const result = await Bun.build({
  entrypoints: [resolve(root, 'entry.tsx')], outdir: resolve(root, '.output'),
  target: 'browser', format: 'esm', splitting: true, minify: true,
  define: { 'process.env': '{"NODE_ENV":"production"}' },
});
if (!result.success) throw new AggregateError(result.logs, 'UI runtime browser artifact failed');
const files = result.outputs.map(file => file.path.split(/[\\/]/).at(-1));
await writeFile(resolve(root, '.output/files.json'), JSON.stringify(files));
await writeFile(resolve(root, '.output/index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>UI runtime fixture</title></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>');
