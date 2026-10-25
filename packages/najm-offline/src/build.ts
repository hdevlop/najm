import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ShellManifest } from './worker';

export const shellHash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex').slice(0, 20);

/** The shell's own document policy: everything it needs is a same-origin file in the manifest. */
export const SHELL_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'";

/** Najm's stand-ins for the framework modules an app's components import. */
function adapter(name: string) {
  for (const extension of ['.js', '.tsx', '.ts']) {
    const path = fileURLToPath(new URL(`./shell/${name}${extension}`, import.meta.url));
    if (existsSync(path)) return path;
  }
  throw new Error(`najm-offline shell adapter ${name} is missing`);
}
export function shellAdapters(): Record<string, string> {
  return {
    'najm-auth/client/react': adapter('auth'),
    'najm-kit': adapter('kit'),
    'next/navigation': adapter('navigation'),
    'next/link': adapter('link'),
    'next/image': adapter('image'),
  };
}

export type OfflineShellBuildOptions = {
  /** The app's directory: `public/` and the output are below it. */
  appRoot: string;
  /** Names the version meta tag, `<namespace>-shell-version`. */
  namespace: string;
  /** The shell's browser entry, which mounts its own provider. */
  entry: string;
  title: string;
  /** Module specifier → file. Najm's adapters (`shellAdapters()`) are always applied; these add to or replace them. */
  aliases?: Record<string, string>;
  /** Defaults to `/offline-shell/`, written to `public/offline-shell`. */
  publicPath?: string;
  stylesheet: {
    /** The app's stylesheet entry. */
    source: string;
    /** Compiles the stylesheet text (Tailwind, …); the result must contain no unexpanded at-rules. */
    compile(input: string, from: string): Promise<string>;
    prepend?: string;
    append?: string;
    /** Refuses a larger compiled stylesheet. Default 500 KB. */
    maxBytes?: number;
    /** A rule the compiled stylesheet must contain, proving it compiled. Default `.flex{`. */
    expect?: string;
  };
  /** Font files below `appRoot`, copied under a content hash; `css` declares them from those paths. */
  fonts?: { files: readonly string[]; css(paths: string[]): string };
  /** Public files (paths below `public/`) the shell uses as they are, such as fallback images and files the app wrote to the output. */
  files?: readonly string[];
  csp?: string;
  log?: (message: string) => void;
};

/**
 * Builds the offline shell: one document, its script and styles, every file
 * they reference, and a manifest the worker precaches. The version covers the
 * document's policy and structure as well as every asset byte, and the build
 * refuses a stylesheet that refers to a file it did not package.
 */
export async function buildOfflineShell(options: OfflineShellBuildOptions): Promise<ShellManifest> {
  const { appRoot } = options;
  const publicPath = options.publicPath ?? '/offline-shell/';
  const output = resolve(appRoot, 'public' + publicPath);
  await mkdir(output, { recursive: true });
  const assetOptions = { publicPath, naming: { asset: '[name]-[hash].[ext]' }, loader: { '.png': 'file', '.svg': 'file', '.jpg': 'file', '.gif': 'file', '.woff2': 'file', '.ttf': 'file' } } as const;
  const aliases = { ...shellAdapters(), ...options.aliases };
  const built = await Bun.build({ entrypoints: [options.entry], target: 'browser', ...assetOptions,
    plugins: [{ name: 'najm-offline-shell-modules', setup(build) {
      for (const [specifier, path] of Object.entries(aliases)) {
        const filter = new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`);
        // An adapter imports the module it stands in for.
        build.onResolve({ filter }, args => args.importer === path ? undefined : ({ path }));
      }
      build.onResolve({ filter: /^next(?:\/|$)/ }, args => { throw new Error(`Unsupported offline framework import: ${args.path} from ${args.importer}`); });
    } }],
    minify: true, splitting: false, define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'process.env': '{}', 'process.browser': 'true' },
  });
  if (!built.success) throw new AggregateError(built.logs, 'Offline shell build failed');
  const script = built.outputs.find(asset => asset.kind === 'entry-point' && asset.path.endsWith('.js'));
  if (!script) throw new Error('Offline JavaScript entry is missing');
  const javascript = await script.text();
  const { stylesheet } = options;
  // Feed the actual stylesheet entry to the compiler. An indirect import-only
  // entry can pass through without expanding @apply/@theme or generating utilities.
  const cssInput = (stylesheet.prepend ?? '') + await readFile(stylesheet.source, 'utf8') + '\n' + (stylesheet.append ?? '');
  const css = await stylesheet.compile(cssInput, stylesheet.source);
  if (Buffer.byteLength(css) > (stylesheet.maxBytes ?? 500_000)) throw new Error('Offline main stylesheet exceeds its budget');
  if (/@(?:tailwind|apply|theme)\b/.test(css) || !css.includes(stylesheet.expect ?? '.flex{')) throw new Error('Offline styles were not compiled');
  // Resolve imported CSS images/fonts too; preserve every emitted asset.
  const source = resolve(stylesheet.source);
  const styled = await Bun.build({ entrypoints: [source], target: 'browser', ...assetOptions,
    plugins: [{ name: 'najm-offline-compiled-css', setup(build) {
      // Files already written to the output enter the manifest below. Keeping
      // them external prevents Bun from inlining them again.
      build.onResolve({ filter: new RegExp('^' + publicPath.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')) }, args => ({ path: args.path, external: true }));
      build.onLoad({ filter: new RegExp(`^${source.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`) }, () => ({ contents: css, loader: 'css' }));
    } }], minify: true,
  });
  if (!styled.success) throw new AggregateError(styled.logs, 'Offline CSS build failed');
  const scriptPath = `${publicPath}app-${shellHash(javascript)}.js`;
  const fontPaths: string[] = [];
  for (const file of options.fonts?.files ?? []) {
    const bytes = await readFile(resolve(appRoot, file));
    const extension = file.slice(file.lastIndexOf('.'));
    const path = `${publicPath}${basename(file, extension)}-${shellHash(bytes)}${extension}`;
    await writeFile(resolve(appRoot, 'public' + path), bytes);
    fontPaths.push(path);
  }
  const fontCss = options.fonts?.css(fontPaths) ?? '';
  const extraAssets: string[] = [];
  const stylePaths: string[] = [];
  for (const asset of [...built.outputs, ...styled.outputs]) {
    if (asset === script) continue;
    const bytes = new Uint8Array(await asset.arrayBuffer());
    const isStyle = asset.path.endsWith('.css');
    const name = isStyle ? `style-${shellHash(bytes)}.css` : basename(asset.path);
    const path = `${publicPath}${name}`;
    await writeFile(resolve(output, name), bytes);
    extraAssets.push(path);
    if (isStyle) stylePaths.push(path);
  }
  const finalStylePath = fontCss ? `${publicPath}fonts-${shellHash(fontCss)}.css` : null;
  await writeFile(resolve(appRoot, 'public' + scriptPath), javascript);
  if (finalStylePath) await writeFile(resolve(appRoot, 'public' + finalStylePath), fontCss);
  for (const path of options.files ?? []) await readFile(resolve(appRoot, 'public' + path));
  const assets = [...new Set([scriptPath, ...extraAssets, ...(finalStylePath ? [finalStylePath] : []), ...fontPaths, ...(options.files ?? [])])];
  // Include HTML policy/structure in build identity as well as every asset byte.
  const sheets = [...stylePaths, ...(finalStylePath ? [finalStylePath] : [])];
  const head = `<meta http-equiv="Content-Security-Policy" content="${options.csp ?? SHELL_CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${options.title}</title>${sheets.map(path => `<link rel="stylesheet" href="${path}">`).join('')}<script type="module" src="${scriptPath}"></script>`;
  const version = shellHash(head + JSON.stringify(assets));
  const html = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="${options.namespace}-shell-version" content="${version}">${head}</head><body><div id="root"></div></body></html>`;
  const document = `${publicPath}shell-${shellHash(html)}.html`;
  await writeFile(resolve(appRoot, 'public' + document), html);
  const manifest: ShellManifest = { version, document, assets };
  // Catch an emitted stylesheet referring to an asset that was never packaged.
  for (const path of stylePaths) {
    const contents = await readFile(resolve(appRoot, 'public' + path), 'utf8');
    for (const [, value] of contents.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)) {
      if (value.startsWith('data:') || value.startsWith('#')) continue;
      if (!assets.includes(value)) throw new Error(`Unpackaged CSS asset in ${path}: ${value}`);
    }
  }
  // A built server's worker reads its own version's manifest (`readShellManifest`); manifest.json names the latest shell.
  await writeFile(resolve(output, `manifest-${manifest.version}.json`), JSON.stringify(manifest));
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest));
  (options.log ?? console.log)(`Offline shell ${manifest.version}: ${script.size} bytes JS, ${assets.length} complete assets (${stylePaths.length} stylesheets)`);
  return manifest;
}
