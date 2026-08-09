// ============================================================================
// najm-theme — root entry
// ============================================================================
//
// The universal surface, and nothing else. Identical to `najm-theme/contracts`
// so that a consumer importing the bare package name gets something safe on
// either side of the client/server boundary rather than whichever half was
// imported first.
//
// The plugin lives at `najm-theme/server`, the schemas at `najm-theme/pg` and
// `najm-theme/sqlite`, the UI at `najm-theme/react`. Each is a separate entry
// on purpose: a root barrel that reached the controllers would pull Drizzle and
// `reflect-metadata` into every client bundle that imported a type from here.
// ============================================================================

export * from "./contracts";
