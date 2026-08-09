// The package's root `bunfig.toml` preloads happy-dom and
// `@testing-library/react`, and `@testing-library/react` cannot be imported
// under the `react-server` condition — it reaches `react-dom/client`, which
// throws on load there. Bun reads `bunfig.toml` from the working directory, so
// the RSC suite runs from this folder with this preload instead. Bun rejects an
// empty `preload` array, hence a file that does nothing.
export {};
