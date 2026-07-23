// ============================================================================
// tokens.ts - Email Plugin Token Definitions
// ============================================================================

export const EMAIL_CONFIG = Symbol.for('najm:email:config');
export const EMAIL_PROVIDER = Symbol.for('najm:email:provider');

// Global token for cross-plugin access (used by auth plugin)
export const EMAIL_SERVICE = Symbol.for('email:service');
