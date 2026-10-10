/**
 * Next's build phase, readable from server code that is not running inside
 * Next. This module has no imports and no side effects, so a Najm server
 * package or a seed script can import it without loading Next or React.
 */

/**
 * True while `next build` evaluates server modules to produce an image. That
 * phase is not an application runtime and must not contact production
 * services: a cache or database client configured during it should fall back
 * to something local and unrequired.
 */
export const isNextBuildPhase = (): boolean => process.env.NEXT_PHASE === 'phase-production-build';
