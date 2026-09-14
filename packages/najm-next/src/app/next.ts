import { cookies, headers } from "next/headers";
import type { AuthKit, ServerSession } from "najm-auth/client/server";
import { createReactServerAuth } from "najm-auth/client/server/react";
import type { NajmOrderedResolveInput, NajmCookieReader } from "najm-kit/server";
import type { NajmThemeDefinition } from "najm-theme/contracts";

import {
  createNajmServerApp,
  type CreateNajmServerAppOptions,
  type NajmServerApp,
  type NajmResolvePreferencesInput,
} from "./server";

type Theme = ReturnType<NajmThemeDefinition["react"]>;
type Appearance = Awaited<ReturnType<Theme["loadAppearance"]>>;
type Branding = Awaited<ReturnType<Theme["loadBranding"]>>;

function userPreferences(user: unknown): NajmOrderedResolveInput["user"] {
  if (typeof user !== "object" || user === null) return undefined;
  return {
    language: "language" in user ? user.language : undefined,
    theme: "theme" in user ? user.theme : undefined,
    timeZone: "timeZone" in user ? user.timeZone : undefined,
  };
}

export interface CreateNajmNextServerAppOptions<TSettings, TPreferences>
  extends Omit<CreateNajmServerAppOptions<TSettings, TPreferences, Appearance, Branding, ServerSession>,
    "auth" | "theme" | "readCookies" | "readHeaders" | "resolvePreferences"> {
  readonly auth: AuthKit;
  readonly theme: Pick<NajmThemeDefinition, "react">;
  readonly themeOptions: Parameters<NajmThemeDefinition["react"]>[0];
  readonly preferences: {
    resolveOrdered(cookies: NajmCookieReader, input?: NajmOrderedResolveInput): TPreferences;
  };
  /** Defaults to true. Set false to preserve institution-only language fallback. */
  readonly acceptLanguage?: boolean;
  /** Optional source policy; resolution and validation remain owned by Najm Kit. */
  readonly preferenceSources?: (
    input: NajmResolvePreferencesInput<TSettings, ServerSession>,
  ) => NajmOrderedResolveInput;
}

/**
 * Next adapter for apps using Najm Auth, Theme and Kit. Create once at module
 * scope in a server-only app module. Construction does not read request state
 * or load the backend; preference route handlers can share that module safely.
 * The lower-level app/server entry remains independent of these optional peers.
 */
export function createNajmNextServerApp<TSettings, TPreferences>(
  options: CreateNajmNextServerAppOptions<TSettings, TPreferences>,
): NajmServerApp<TSettings, TPreferences, Appearance, Branding, ServerSession> {
  return createNajmServerApp({
    app: options.app,
    auth: createReactServerAuth(options.auth),
    theme: options.theme.react(options.themeOptions),
    readSettings: options.readSettings,
    fallbackSettings: options.fallbackSettings,
    onDiagnostic: options.onDiagnostic,
    readCookies: cookies,
    readHeaders: headers,
    resolvePreferences: (input) => options.preferences.resolveOrdered(input.cookies, {
      user: userPreferences(input.session?.user),
      acceptLanguage: options.acceptLanguage === false ? undefined : input.headers.get("accept-language"),
      ...options.preferenceSources?.(input),
    }),
  });
}
