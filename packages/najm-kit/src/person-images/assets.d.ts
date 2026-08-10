/**
 * Type shim for `.webp` asset imports.
 *
 * The esbuild `dataurl` loader replaces every `.webp` import with a
 * `data:image/webp;base64,…` string at build time, so the source can treat
 * the file like any other module and the published bundle ships one
 * self-contained entry with no separate asset file. The shim only exists
 * for `tsc`, which does not know about esbuild's loader.
 */
declare module '*.webp' {
  const src: string;
  export default src;
}
