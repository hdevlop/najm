/** The offline shell's worker lifecycle in the page: registration, readiness, staged updates and stored logos. */
export { cacheShellBranding, withCachedBranding, type ShellBrandingOptions } from './client/branding';
export { isActiveShellReady } from './client/readiness';
export { prepareShell, registerShell, retryPreparation } from './client/registration';
export { createShellUpdates, isUpdateEdit, type ShellUpdateOptions, type ShellUpdates } from './client/updates';
