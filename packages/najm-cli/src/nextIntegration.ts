import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export const NAJM_NEXT_INTEGRATION_VERSIONS = Object.freeze({
  auth: '4.0.4',
  kit: '2.15.3',
  next: '0.8.0',
  theme: '0.2.1',
});

export type NextLocationChoice = 'disabled' | 'leaflet' | 'google';

export interface NextIntegrationOptions {
  appId: string;
  basePath?: string;
  auth: boolean;
  theme: boolean;
  location: NextLocationChoice;
}

export interface NextIntegrationFile {
  path: string;
  content: string;
}

export interface NextIntegrationPlan {
  options: Required<NextIntegrationOptions>;
  files: readonly NextIntegrationFile[];
  dependencies: readonly string[];
  devDependencies: readonly string[];
}

export type NextIntegrationFileStatus = 'create' | 'unchanged' | 'conflict';

export interface NextIntegrationPreviewEntry extends NextIntegrationFile {
  status: NextIntegrationFileStatus;
}

export const PROTECTED_LAYOUT_TEMPLATE = `import { requireSession } from '@/najm.server';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <>{children}</>;
}
`;

const DEFAULT_CENTER = '{ latitude: 33.5731, longitude: -7.5898 }';

function normalizeAppId(value: string): string {
  const appId = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) {
    throw new TypeError('appId must start with a letter and contain only lowercase letters, numbers, and hyphens');
  }
  return appId;
}

function normalizeBasePath(value: string | undefined): string {
  const basePath = (value ?? 'src/server').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (!basePath || path.posix.isAbsolute(basePath) || basePath.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new TypeError('basePath must be a relative project path without dot segments');
  }
  return basePath;
}

function title(value: string): string {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function locationDefinition(choice: NextLocationChoice): string {
  if (choice === 'leaflet') {
    return `  allowedProviders: ['leaflet'],\n  defaults: {\n    provider: 'leaflet',\n    center: ${DEFAULT_CENTER},\n    zoom: 12,\n    leaflet: {\n      tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',\n      attribution: '&copy; OpenStreetMap contributors',\n    },\n  },`;
  }
  if (choice === 'google') {
    return `  allowedProviders: ['google'],\n  defaults: {\n    provider: 'google',\n    center: ${DEFAULT_CENTER},\n    zoom: 12,\n    google: { region: 'MA' },\n  },`;
  }
  return `  allowedProviders: ['disabled'],\n  defaults: {\n    provider: 'disabled',\n    center: ${DEFAULT_CENTER},\n    zoom: 12,\n  },`;
}

function appConfig(options: Required<NextIntegrationOptions>): string {
  const locationPolicy = options.location === 'disabled'
    ? ''
    : options.location === 'leaflet'
      ? '  location: true,\n'
      : `  location: {\n${locationDefinition(options.location)}\n  },\n`;
  return `import { defineNajmApp } from 'najm-next/app';

export const app = defineNajmApp({
  id: '${options.appId}',
  appName: '${title(options.appId)}',
  auth: {
    apiBaseURL: '/api',
    authPrefix: '/auth',
    publicRoutes: ['/', '/login'],
    protectedRoutes: ['/dashboard/:path*'],
    roleRoutes: {},
    loginRoute: '/login',
    forbiddenRoute: '/forbidden',
    proxySessionMode: 'optimistic',
    rememberCookieName: '${options.appId}.remember',
    refreshThreshold: 0.8,
    tabSync: true,
  },
  preferences: {
    cookieNames: {
      language: '${options.appId}-ui-language',
      theme: '${options.appId}-ui-theme',
      timeZone: '${options.appId}-ui-timezone',
    },
    defaultTimeZone: 'Africa/Casablanca',
  },
  csp: {
    reportPath: '/api/csp-report',
    frameSrc: ["'none'"],
  },
${locationPolicy}
});
`;
}

function authConfig(): string {
  return `import { defineAuth } from 'najm-auth/client/server';

import { app } from '@/najm.config';

export const auth = defineAuth({
  apiBaseURL: app.auth.apiBaseURL,
  authPrefix: app.auth.authPrefix,
  publicRoutes: [...app.auth.publicRoutes],
  protectedRoutes: [...app.auth.protectedRoutes],
  roleRoutes: Object.fromEntries(
    Object.entries(app.auth.roleRoutes ?? {}).map(([route, roles]) => [
      route,
      Array.from(roles as readonly string[]),
    ]),
  ),
  loginRoute: app.auth.loginRoute,
  forbiddenRoute: app.auth.forbiddenRoute,
  proxySessionMode: app.auth.proxySessionMode,
  refreshThreshold: app.auth.refreshThreshold,
  tabSync: app.auth.tabSync,
});
`;
}

function preferencesConfig(): string {
  return `import { defineNajmPreferences } from 'najm-kit/server';

import { app } from '@/najm.config';

const i18n = {
  supportedLanguages: ['en'] as const,
  defaultLanguage: 'en' as const,
  normalizeLanguage(value: unknown) {
    return value === 'en' ? value : 'en';
  },
};

export const preferences = defineNajmPreferences({
  i18n,
  defaultTimeZone: app.preferences.defaultTimeZone,
  cookieNames: app.preferences.cookieNames,
});
`;
}

function starterTheme(): string {
  return `import type { PublicAppearance, PublicBranding } from 'najm-theme';

const appearance: PublicAppearance = {
  designConfig: { version: 1, theme: {}, components: {} },
  revision: 1,
};
const branding: PublicBranding = { slots: {}, revision: 1 };

/**
 * Compilable factory fallback for a new app. Replace this structural binding
 * with your definition-backed \`theme.react(...)\` adapter when persistence is enabled.
 */
export const starterTheme = {
  async loadAppearance() { return appearance; },
  async loadBranding() { return branding; },
};
`;
}

function serverBinding(options: Required<NextIntegrationOptions>): string {
  const usesKit = options.theme || options.location !== 'disabled';
  const authImports = options.auth
    ? `import { createReactServerAuth } from 'najm-auth/client/server/react';\nimport { auth } from '@/lib/auth';\n`
    : '';
  const themeImports = options.theme ? `import { starterTheme } from '@/najm.theme';\n` : '';
  const preferenceImports = usesKit ? `import { preferences } from '@/preferences';\n` : '';
  const authBinding = options.auth
    ? 'const serverAuth = createReactServerAuth(auth);'
    : `const serverAuth = {
  async getSession() { return null; },
  async requireSession(): Promise<never> { throw new Error('Authentication is not enabled'); },
  async requireRole(): Promise<never> { throw new Error('Authentication is not enabled'); },
};`;
  const themeBinding = options.theme
    ? 'const serverTheme = starterTheme;'
    : `const serverTheme = {
  async loadAppearance() { return { designConfig: { version: 1 as const, theme: {}, components: {} }, revision: 1 }; },
  async loadBranding() { return { slots: {}, revision: 1 }; },
};`;
  const resolvePreferences = usesKit
    ? `resolvePreferences: ({ cookies: cookieStore, headers: requestHeaders, session }) =>
    preferences.resolveOrdered(cookieStore, {
      user: (session?.user ?? {}) as { language?: unknown; theme?: unknown; timeZone?: unknown },
      acceptLanguage: requestHeaders.get('accept-language'),
    }),`
    : `resolvePreferences: () => ({
    language: 'en' as const,
    theme: 'light' as const,
    timeZone: app.preferences.defaultTimeZone,
  }),`;

  return `import 'server-only';

import { cookies, headers } from 'next/headers';
import { createNajmServerApp } from 'najm-next/app/server';
import { defineNajmAppLocationRuntime } from 'najm-next/location/server';
${authImports}${themeImports}${preferenceImports}
import { app } from '@/najm.config';

${authBinding}
${themeBinding}

const locationConfig = defineNajmAppLocationRuntime(app)?.resolve(process.env, {
  isDevelopment: process.env.NODE_ENV === 'development',
}).config;

export const najmServer = createNajmServerApp({
  app,
  auth: serverAuth,
  theme: serverTheme,
  readSettings: async () => locationConfig ? { locationConfig } : {},
  fallbackSettings: locationConfig ? { locationConfig } : {},
  readCookies: cookies,
  readHeaders: headers,
  ${resolvePreferences}
  onDiagnostic: (diagnostic) => console.warn('[${options.appId}] UI fallback', diagnostic),
});

export const { getSession, requireSession, requireRole, loadSettings, loadUiSnapshot } = najmServer;
`;
}

function providers(options: Required<NextIntegrationOptions>): string {
  if (options.auth && options.theme) return fullClientProviders(options);

  const usesKit = options.theme || options.location !== 'disabled';
  const imports = [
    `'use client';`,
    '',
    `import type { ReactNode } from 'react';`,
    `import { bindNajmNextProvider, NajmNextAppProvider, type NajmNextProviderContext } from 'najm-next/app/react';`,
  ];
  if (options.auth) {
    imports.push(`import type { ServerSession } from 'najm-auth/client/server';`);
    imports.push(`import { AuthProvider } from 'najm-auth/client/react';`);
    imports.push(`import { auth } from '@/lib/auth';`);
  }
  if (usesKit && options.location !== 'leaflet') {
    imports.push(`import type { NLocationRuntimeConfig } from 'najm-kit/location/runtime';`);
  }
  if (options.location === 'leaflet') {
    imports.push(`import { NLeafletLocationRuntimeProvider, type NLeafletLocationRuntimeProviderProps } from 'najm-kit/location/runtime/leaflet';`);
  }
  if (options.location === 'google') {
    imports.push(`import { lazy, useMemo } from 'react';`);
    imports.push(`import { NLocationProvider, type NLocationMapAdapter } from 'najm-kit/location';`);
  }
  if (options.theme) {
    imports.push(`import type { NajmDesignConfig } from 'najm-kit';`);
    imports.push(`import { NajmAppProvider } from 'najm-kit/app';`);
    imports.push(`import type { PublicBranding } from 'najm-theme';`);
    imports.push(`import { NThemeBrandingProvider } from 'najm-theme/react';`);
  }

  const appearanceType = options.theme
    ? `{ designConfig: NajmDesignConfig; revision: number }`
    : `{ designConfig: { version: 1; theme: object; components: object }; revision: number }`;
  const brandingType = options.theme
    ? 'PublicBranding'
    : `{ slots: Record<string, string | null>; revision: number }`;
  const locationType = options.location === 'leaflet'
    ? `NLeafletLocationRuntimeProviderProps['config']`
    : options.location === 'google'
      ? `Exclude<NLocationRuntimeConfig, { provider: 'leaflet' }>`
      : usesKit
        ? `Extract<NLocationRuntimeConfig, { provider: 'disabled' }>`
        : `{ provider: 'disabled'; defaultCenter: { latitude: number; longitude: number }; defaultZoom: number }`;

  const bindings: string[] = [];
  const providerEntries: string[] = [];
  if (options.auth) {
    bindings.push(`const authProvider = bindNajmNextProvider(
  AuthProvider,
  ({ snapshot }: ProviderContext) => ({
    client: auth.client,
    initialSession: snapshot.session as ServerSession | null,
  }),
);`);
    providerEntries.push('auth: authProvider');
  }
  if (options.theme) {
    bindings.push(`function UiProvider({ children, snapshot }: Readonly<{ children: ReactNode; snapshot: AppUiSnapshot }>) {
  return (
    <NajmAppProvider
      snapshot={snapshot}
    >
      {children}
    </NajmAppProvider>
  );
}

const uiProvider = bindNajmNextProvider(
  UiProvider,
  ({ snapshot }: ProviderContext) => ({ snapshot }),
);
const brandingProvider = bindNajmNextProvider(
  NThemeBrandingProvider,
  ({ snapshot }: ProviderContext) => ({ branding: snapshot.branding }),
);`);
    providerEntries.push('ui: uiProvider', 'branding: brandingProvider');
  }
  if (options.location === 'leaflet') {
    bindings.push(`const locationProvider = bindNajmNextProvider(
  NLeafletLocationRuntimeProvider,
  ({ snapshot }: ProviderContext) => ({ config: snapshot.settings.locationConfig }),
);`);
    providerEntries.push('location: locationProvider');
  }
  if (options.location === 'google') {
    bindings.push(`function GoogleLocationProvider({ children, config }: Readonly<{ children: ReactNode; config: Exclude<NLocationRuntimeConfig, { provider: 'leaflet' }> }>) {
  const adapter = useMemo<NLocationMapAdapter | null>(() => {
    if (config.provider !== 'google') return null;
    const options = config.google;
    const Map = lazy(async () => {
      const { createGoogleLocationAdapter } = await import('najm-kit/location/google');
      return { default: createGoogleLocationAdapter(options).Map };
    });
    return { id: 'google', Map };
  }, [config]);
  return (
    <NLocationProvider
      adapter={adapter}
      defaultCenter={config.defaultCenter}
      defaultZoom={config.defaultZoom}
    >
      {children}
    </NLocationProvider>
  );
}

const locationProvider = bindNajmNextProvider(
  GoogleLocationProvider,
  ({ snapshot }: ProviderContext) => ({ config: snapshot.settings.locationConfig }),
);`);
    providerEntries.push('location: locationProvider');
  }

  return `${imports.join('\n')}

export interface AppUiSnapshot {
  app: { appName?: string; currency?: string };
  session: unknown;
  preferences: { language: 'en'; theme: 'light' | 'dark'; timeZone: string };
  appearance: ${appearanceType};
  branding: ${brandingType};
  settings: { locationConfig: ${locationType} };
}

type ProviderContext = NajmNextProviderContext<AppUiSnapshot>;

${bindings.join('\n\n')}

const providers = { ${providerEntries.join(', ')} } as const;

export function AppProviders({ children, snapshot }: Readonly<{ children: ReactNode; snapshot: AppUiSnapshot }>) {
  return (
    <NajmNextAppProvider snapshot={snapshot} providers={providers}>
      {children}
    </NajmNextAppProvider>
  );
}
`;
}

function fullClientProviders(options: Required<NextIntegrationOptions>): string {
  return `'use client';

import type { ReactNode } from 'react';
import type { ServerSession } from 'najm-auth/client/server';
import { NajmAppProvider } from 'najm-next/app/client';
import type { NajmDesignConfig } from 'najm-kit';
import type { NLocationRuntimeConfig } from 'najm-kit/location/runtime';
import type { PublicBranding } from 'najm-theme';
import { auth } from '@/lib/auth';

export interface AppUiSnapshot {
  app: { appName?: string; currency?: string };
  session: ServerSession | null;
  preferences: { language: 'en'; theme: 'light' | 'dark'; timeZone: string };
  appearance: { designConfig: NajmDesignConfig; revision: number };
  branding: PublicBranding;
  settings: { locationConfig?: NLocationRuntimeConfig };
}

export function AppProviders({ children, snapshot }: Readonly<{ children: ReactNode; snapshot: AppUiSnapshot }>) {
  return (
    <NajmAppProvider
      authClient={auth.client}
      snapshot={snapshot}
    >
      {children}
    </NajmAppProvider>
  );
}
`;
}

function proxyTemplate(options: Required<NextIntegrationOptions>): string {
  const authImport = options.auth
    ? `import { auth } from '@/lib/auth';`
    : `import { NextResponse } from 'next/server';`;
  const authBinding = options.auth
    ? 'auth,'
    : `auth: {
    async proxy(request, init) {
      const requestHeaders = new Headers(request.headers);
      new Headers(init?.requestHeaders).forEach((value, key) => requestHeaders.set(key, value));
      return NextResponse.next({ request: { headers: requestHeaders } });
    },
  },`;
  return `${authImport}
import { composeNajmProxy } from 'najm-next/security';

import { app } from '@/najm.config';

export default composeNajmProxy({
  ${authBinding}
  app,
});

// Keep this literal in the application: Next.js statically analyzes it.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\\\.(?:css|js|map|json|txt|xml|ico|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|webmanifest)$).*)',
  ],
};
`;
}

function apiRoute(options: Required<NextIntegrationOptions>, basePath: string): string {
  const relativeServer = basePath === 'src/server' ? '@/server' : `@/${basePath.slice(4)}`;
  const handler = options.auth
    ? `const handlers = auth.routeHandlers(serverHandler, {
  rememberCookieName: app.auth.rememberCookieName,
});
export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handlers;`
    : `export const GET = serverHandler;
export const POST = serverHandler;
export const PUT = serverHandler;
export const PATCH = serverHandler;
export const DELETE = serverHandler;
export const HEAD = serverHandler;
export const OPTIONS = serverHandler;`;
  return `import { handle } from 'najm-core';
import server from '${relativeServer}';
${options.auth ? `import { auth } from '@/lib/auth';\nimport { app } from '@/najm.config';\n` : ''}
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const serverHandler = handle(server);
${handler}
`;
}

function layout(): string {
  return `import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { loadUiSnapshot } from '@/najm.server';
import { AppProviders, type AppUiSnapshot } from '@/providers';

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const snapshot = await loadUiSnapshot() as AppUiSnapshot;
  return (
    <html lang={snapshot.preferences.language} suppressHydrationWarning>
      <body><AppProviders snapshot={snapshot}>{children}</AppProviders></body>
    </html>
  );
}
`;
}

function preferenceRoute(kind: 'language' | 'theme' | 'timeZone'): string {
  return `import { preferences } from '@/preferences';

export const { POST, DELETE } = preferences.routes.${kind};
`;
}

export function createNextIntegrationPlan(input: NextIntegrationOptions): NextIntegrationPlan {
  const options: Required<NextIntegrationOptions> = {
    appId: normalizeAppId(input.appId),
    basePath: normalizeBasePath(input.basePath),
    auth: input.auth,
    theme: input.theme,
    location: input.location,
  };
  const usesKit = options.theme || options.location !== 'disabled';
  const files: NextIntegrationFile[] = [
    { path: 'next.config.ts', content: `export { default } from 'najm-next/config';\n` },
    { path: 'src/najm.config.ts', content: appConfig(options) },
    { path: 'src/najm.server.ts', content: serverBinding(options) },
    { path: 'src/providers.tsx', content: providers(options) },
    { path: 'src/proxy.ts', content: proxyTemplate(options) },
    { path: 'src/instrumentation-client.ts', content: `import 'najm-next/instrumentation/client';\n` },
    { path: 'src/app/layout.tsx', content: layout() },
    { path: 'src/app/page.tsx', content: `export default function HomePage() { return <main><h1>${title(options.appId)}</h1></main>; }\n` },
    { path: 'src/app/api/csp-report/route.ts', content: `import { createCspReportHandler } from 'najm-next/security/reports';\n\nexport const POST = createCspReportHandler();\n` },
    { path: 'src/app/api/[...route]/route.ts', content: apiRoute(options, options.basePath) },
    { path: `${options.basePath}/index.ts`, content: `import 'reflect-metadata';\n\nimport { Server } from 'najm-core';\n\nconst server = new Server({ serverless: true }).base('/api');\n\nexport default server;\n` },
    { path: `${options.basePath}/modules/index.ts`, content: '' },
  ];
  if (options.auth) files.push({ path: 'src/lib/auth.ts', content: authConfig() });
  if (usesKit) {
    files.push({ path: 'src/preferences.ts', content: preferencesConfig() });
    files.push(
      { path: 'src/app/api/ui-language/route.ts', content: preferenceRoute('language') },
      { path: 'src/app/api/ui-theme/route.ts', content: preferenceRoute('theme') },
      { path: 'src/app/api/ui-timezone/route.ts', content: preferenceRoute('timeZone') },
    );
  }
  if (options.theme) files.push({ path: 'src/najm.theme.ts', content: starterTheme() });

  const dependencies = [
    'najm-core@2.0.6',
    `najm-next@${NAJM_NEXT_INTEGRATION_VERSIONS.next}`,
    'reflect-metadata@0.2.2',
  ];
  if (options.auth) dependencies.push(`najm-auth@${NAJM_NEXT_INTEGRATION_VERSIONS.auth}`, 'server-only@0.0.1');
  if (usesKit) dependencies.push(`najm-kit@${NAJM_NEXT_INTEGRATION_VERSIONS.kit}`);
  if (options.theme) dependencies.push(
    `najm-theme@${NAJM_NEXT_INTEGRATION_VERSIONS.theme}`,
    '@tanstack/react-query@5.100.1',
  );
  if (options.location === 'leaflet') dependencies.push('leaflet@1.9.4');
  if (options.location === 'google') dependencies.push('@googlemaps/js-api-loader@2.1.1');

  return Object.freeze({
    options: Object.freeze(options),
    files: Object.freeze(files),
    dependencies: Object.freeze(dependencies),
    devDependencies: Object.freeze([
      'typescript@5.9.3',
      '@types/node@20.19.25',
      '@types/react@19.2.14',
      '@types/react-dom@19.2.3',
    ]),
  });
}

function resolveTarget(root: string, relativePath: string): string {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, relativePath);
  const relative = path.relative(absoluteRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new TypeError(`Unsafe generated path: ${relativePath}`);
  }
  return target;
}

export async function previewNextIntegrationPlan(
  root: string,
  plan: NextIntegrationPlan,
): Promise<NextIntegrationPreviewEntry[]> {
  return Promise.all(plan.files.map(async (file) => {
    const target = resolveTarget(root, file.path);
    try {
      const existing = await readFile(target, 'utf8');
      return { ...file, status: existing === file.content ? 'unchanged' : 'conflict' } as const;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...file, status: 'create' } as const;
      throw error;
    }
  }));
}

export async function applyNextIntegrationPlan(
  root: string,
  plan: NextIntegrationPlan,
): Promise<NextIntegrationPreviewEntry[]> {
  const preview = await previewNextIntegrationPlan(root, plan);
  const conflicts = preview.filter((entry) => entry.status === 'conflict');
  if (conflicts.length > 0) {
    throw new Error(`Refusing to overwrite existing files:\n${conflicts.map((entry) => `- ${entry.path}`).join('\n')}`);
  }
  for (const entry of preview) {
    if (entry.status !== 'create') continue;
    const target = resolveTarget(root, entry.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.content, { encoding: 'utf8', flag: 'wx' });
  }
  return preview;
}
