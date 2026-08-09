import { Server } from 'najm-core';
import { cors } from 'najm-cors';
import { guards } from 'najm-guard';
import { storage } from 'najm-storage';
import { theme } from 'najm-theme/server';
import { themeSchema } from 'najm-theme/sqlite';
import { validation } from 'najm-validation';
import { databaseConfig } from './config/database';
import { isLocalStudio } from './config/guards';
import { factoryBranding, factoryDesign, studioBrandingSlots } from './config/theme';
import * as modulesModule from './modules';

const isLocalhostOrigin = (origin?: string) =>
  !!origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);

// ============================================================================
// Managed mode.
//
// `najm-theme` is registered here exactly as an application registers it — no
// tsconfig path, no bundler alias, resolved through `node_modules` to the
// published `dist`. That is the point of the mode: the Studio's own screens edit
// a design *document*, while these routes drive a running application's
// appearance through the package's own persistence, revisions, and storage.
//
// The two never share a database. See `config/database.ts`.
// ============================================================================

export const server = new Server()
  .use(cors({
    origin: ((origin: string) => isLocalhostOrigin(origin) ? origin : undefined) as unknown as string,
    credentials: true,
  }))
  .use(databaseConfig())
  .use(validation())
  .use(guards())
  .use(storage({
    provider: 'local',
    basePath: 'storage',
    guards: [isLocalStudio()],
    maxFileSize: 8 * 1024 * 1024,
  }))
  .use(theme({
    features: {
      appearance: true,
      branding: true,
      presets: true,
      assetUploads: true,
      mcp: false,
    },
    database: 'managed',
    dialect: 'sqlite',
    schema: themeSchema,
    // The Studio previews the managed appearance without signing in, which is
    // the same reason a real application makes these reads public: the sign-in
    // page renders the theme and the logo before there is a session.
    publicRead: true,
    factory: { appearance: () => factoryDesign, branding: factoryBranding },
    brandingSlots: studioBrandingSlots,
    guards: {
      manageAppearance: [isLocalStudio()],
      manageBranding: [isLocalStudio()],
      managePresets: [isLocalStudio()],
    },
    storage: { namespace: 'studio-branding' },
    diagnostics: (diagnostic) => console.warn('[theme]', diagnostic.code, diagnostic.detail ?? ''),
  }))
  .base('/api')
  .load(modulesModule);
