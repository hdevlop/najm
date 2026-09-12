import { defineNajmNextConfig } from 'najm-next/configurable';

// Composed through the shared Najm config contract (built public export), the
// way real apps do it: distDir resolves from NAJM_NEXT_DIST_DIR inside the
// preset, and the turbopack root / tracing root are pinned to the discovered
// workspace root instead of hand-built here. Nothing in this file may
// hard-code the repository root.
export default defineNajmNextConfig();
