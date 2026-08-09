// The React suite runs with a happy-dom preload and `@testing-library/react`,
// neither of which can load under the `react-server` condition —
// `react-dom/client` throws there. Bun reads `bunfig.toml` from the working
// directory, so the RSC suite runs from this folder with a preload that does
// nothing. Bun rejects an empty `preload` array, hence a file rather than none.
export {};
