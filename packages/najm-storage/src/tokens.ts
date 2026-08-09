// ============================================================================
// najm-storage - DI Tokens
// ============================================================================

export const STORAGE_CONFIG = Symbol.for('najm:storage:config');

/**
 * Resolution token for the one `StorageService` this server owns.
 *
 * `StorageService` is a fine token inside this package, where there is only one
 * copy of the class. It is not a safe token across package boundaries: a
 * consumer package resolving `najm-storage` through its own `node_modules`
 * (dist) while the application resolves it through a tsconfig path (src) holds
 * a different constructor, and `container.resolve(StorageService)` then builds a
 * second service with its own provider and its own configuration instead of
 * returning the application's.
 *
 * `Symbol.for` is keyed on the string in a process-wide registry, so every copy
 * of this module produces the identical symbol. External packages must resolve
 * this token, never the class.
 */
export const STORAGE_SERVICE = Symbol.for('najm:storage:service');
