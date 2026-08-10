// The seven person illustrations are imported as modules from
// `src/person-images/builtIn.ts` and turned into `data:image/webp;base64,…`
// strings by the esbuild `dataurl` loader configured in `tsup.config.ts`.
// esbuild resolves those imports on its own, but the `dts` half of the build
// runs tsc, which has no notion of a `.webp` module and fails with TS2307
// unless the extension is declared here.
//
// Declared package-wide for the same reason the loader is: `person-images` is
// the only entry that imports `.webp`, so a stray import elsewhere is
// something to investigate rather than something to keep working.
declare module '*.webp' {
  /** A `data:image/webp;base64,…` string produced by the dataurl loader. */
  const src: string;
  export default src;
}
