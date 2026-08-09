// ============================================================================
// najm-theme/server — DI tokens
// ============================================================================
//
// `Symbol.for`, not `Symbol`. A bundler that emits two copies of this module —
// which is exactly what happens when an application imports the plugin and a
// test imports a service directly — would otherwise produce two distinct
// symbols, and the second lookup would resolve nothing.
// ============================================================================

export const THEME_CONFIG = Symbol.for("najm:theme:config");
export const THEME_SCHEMA = Symbol.for("najm:theme:schema");
