import type { ReactNode } from 'react';

export interface AppearanceConfig {
  className?: string;
  style?: React.CSSProperties;
}

export type StudioAuthMode = 'session' | 'standalone';

export interface RagStudioProviderProps {
  apiBase: string;
  /** Pathname where the studio is mounted in the host app (e.g. "/rag-studio").
   *  Used as the prefix for all client-side URL updates. Defaults to auto-detect. */
  basePath?: string;
  getAuthHeaders?: () => HeadersInit;
  /**
   * How the studio authenticates against `apiBase`:
   * - `'session'` (default) — piggyback the host app's session (cookies). The host
   *   may pass `getAuthHeaders` for custom headers. No login screen.
   * - `'standalone'` — the studio logs in itself against najm-auth and sends a
   *   Bearer token. Shows a login screen until authenticated.
   */
  auth?: StudioAuthMode;
  /**
   * Base URL of the target app's najm-auth endpoints (`/login`, `/refresh`),
   * used in `'standalone'` mode. Defaults to deriving from `apiBase`
   * (`.../rag-studio` → `.../auth`).
   */
  authApiBase?: string;
  chatbotSettingsUrl?: string;
  chatbotSettingsApiPath?: string | null;
  chatbotSettingsTestApiPath?: string;
  appearance?: AppearanceConfig;
  children: ReactNode;
}

export interface RagStudioProps {
  /** Pass true when embedding inside a parent app that provides its own design tokens.
   *  The studio will only apply its accent color and inherit everything else. */
  inheritTheme?: boolean;
}
