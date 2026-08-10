// ============================================================================
// Playground e2e — shared constants
// ============================================================================

/** The production server the acceptance run measures. Never booted by the suite. */
export const BASE_URL = process.env.PLAYGROUND_E2E_BASE_URL ?? 'http://127.0.0.1:3000';

/**
 * Where the acceptance screenshots land.
 *
 * Committed evidence, not scratch output, so it is a repository path rather
 * than Playwright's `outputDir` — the plan names each file by the state it
 * shows, and a reviewer reads them straight from the tree.
 */
export const EVIDENCE_DIR = '../../docs/evidence/najm-theme-0.2/playground';

/** Seeded by `db:seed`; the credentials are committed in the seed itself. */
export const ADMIN = {
  identifier: 'admin@admin.com',
  password: 'Admin123!',
} as const;

/**
 * The four fixed slots, with the factory file each one ships in `theme/`.
 *
 * Both extensions appear on purpose: proving PNG *and* WebP render from real
 * responses is a release gate, and a single-format factory directory would
 * quietly retire half of it.
 */
export const SLOTS = [
  { key: 'sidebarLogoExpanded', label: 'Sidebar logo', factoryExt: 'png' },
  { key: 'sidebarLogoCollapsed', label: 'Sidebar icon', factoryExt: 'webp' },
  { key: 'authLogo', label: 'Sign-in logo', factoryExt: 'webp' },
  { key: 'authHeroImage', label: 'Sign-in image', factoryExt: 'png' },
] as const;

/**
 * Console noise this application produces outside the theme feature.
 *
 * Listed rather than tolerated by a blanket filter: the acceptance bar is "no
 * console error", so every exemption has to be a named, understood one that a
 * reviewer can challenge. Anything not matching here fails the run.
 *
 * - `favicon.ico` — the playground ships no icon.
 * - `/api/cart` — the storefront demo probes the cart before a session exists.
 */
export const ALLOWED_CONSOLE_NOISE = [/\/favicon\.ico/, /\/api\/cart/] as const;
