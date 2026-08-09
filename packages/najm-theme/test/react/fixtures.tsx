import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

import { STANDARD_BRANDING_SLOTS } from "../../src/contracts/branding";
import { NThemeSettingsProvider } from "../../src/react/providers/NThemeSettingsProvider";
import type { NThemeSettingsProviderProps } from "../../src/react/providers/NThemeSettingsProvider";
import type { ThemeClient } from "../../src/react/api/client";
import type {
  AdminAppearanceResponse,
  AdminBrandingResponse,
  ThemePresetsResponse,
} from "../../src/react/types";
import type { NajmDesignConfig } from "../../src/contracts";

export const DESIGN: NajmDesignConfig = {
  version: 1,
  theme: { tokens: { primary: "#0ea5e9" } },
  typography: { fontSans: "Inter" },
};

export const ALL_FEATURES = {
  appearance: true,
  branding: true,
  presets: true,
  assetUploads: true,
  mcp: false,
} as const;

export const ALL_CAPABILITIES = {
  readAppearance: true,
  manageAppearance: true,
  readBranding: true,
  manageBranding: true,
  uploadBrandingAssets: true,
  readPresets: true,
  managePresets: true,
} as const;

export function appearanceResponse(
  overrides: Partial<AdminAppearanceResponse> = {},
): AdminAppearanceResponse {
  return {
    designConfig: structuredClone(DESIGN),
    revision: 3,
    isFactory: false,
    updatedAt: "2026-08-09T00:00:00.000Z",
    updatedByActorId: "u_1",
    features: { ...ALL_FEATURES },
    capabilities: { ...ALL_CAPABILITIES },
    limits: { maxDesignBytes: 262_144 },
    ...overrides,
  };
}

export function brandingResponse(
  overrides: Partial<AdminBrandingResponse> = {},
): AdminBrandingResponse {
  return {
    slots: STANDARD_BRANDING_SLOTS.map((slot, index) => ({
      key: slot.key,
      kind: slot.kind,
      labelKey: slot.labelKey,
      maxBytes: slot.maxBytes,
      acceptedMimeTypes: [...slot.acceptedMimeTypes],
      previewAspect: slot.previewAspect ?? "natural",
      resolvedPath: index === 0 ? "/brand/logo.png" : null,
      isCustom: false,
      inheritedFrom: index === 0 ? "factory" : null,
      uploadedAt: null,
    })),
    revision: 2,
    updatedAt: null,
    updatedByActorId: null,
    features: { ...ALL_FEATURES },
    capabilities: { ...ALL_CAPABILITIES },
    ...overrides,
  };
}

export function presetsResponse(
  overrides: Partial<ThemePresetsResponse> = {},
): ThemePresetsResponse {
  return {
    presets: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        scopeId: "platform",
        slug: "winter",
        name: "Winter",
        designConfig: { version: 1, theme: { tokens: { primary: "#111111" } } },
        isBuiltIn: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    limits: { maxPresets: 50, allowBuiltInPresetDeletion: false },
    ...overrides,
  };
}

export interface FakeClientCalls {
  saveAppearance: unknown[];
  resetAppearance: unknown[];
  saveBranding: unknown[];
  resetBranding: unknown[];
  uploadBrandingAsset: unknown[];
  deleteBrandingAsset: unknown[];
  applyPreset: unknown[];
  createPreset: unknown[];
  deletePreset: unknown[];
}

export interface FakeClient {
  client: ThemeClient;
  calls: FakeClientCalls;
  /** Make the next call of a method reject with this error. */
  failNext(method: keyof FakeClientCalls, error: Error): void;
}

function conflictError(): Error {
  const error = new Error("appearance was modified by someone else") as Error & {
    status: number;
    code: string;
    conflict: boolean;
  };
  error.status = 409;
  error.code = "THEME_REVISION_CONFLICT";
  error.conflict = true;
  return error;
}

export const CONFLICT = conflictError;

export function makeFakeClient(
  responses: {
    appearance?: AdminAppearanceResponse;
    branding?: AdminBrandingResponse;
    presets?: ThemePresetsResponse;
  } = {},
): FakeClient {
  const calls: FakeClientCalls = {
    saveAppearance: [],
    resetAppearance: [],
    saveBranding: [],
    resetBranding: [],
    uploadBrandingAsset: [],
    deleteBrandingAsset: [],
    applyPreset: [],
    createPreset: [],
    deletePreset: [],
  };

  const failures = new Map<keyof FakeClientCalls, Error>();

  const guard = <T,>(method: keyof FakeClientCalls, input: unknown, result: T): Promise<T> => {
    calls[method].push(input);
    const failure = failures.get(method);
    if (failure) {
      failures.delete(method);
      return Promise.reject(failure);
    }
    return Promise.resolve(result);
  };

  const appearance = responses.appearance ?? appearanceResponse();
  const branding = responses.branding ?? brandingResponse();
  const presets = responses.presets ?? presetsResponse();

  const client: ThemeClient = {
    baseUrl: "/api/theme",
    getAppearance: async () => ({
      designConfig: appearance.designConfig,
      revision: appearance.revision,
    }),
    getAppearanceConfig: async () => appearance,
    saveAppearance: (input) =>
      guard("saveAppearance", input, {
        designConfig: (input.designConfig ?? appearance.designConfig) as NajmDesignConfig,
        revision: appearance.revision + 1,
      }),
    resetAppearance: (input) =>
      guard("resetAppearance", input, {
        designConfig: appearance.designConfig,
        revision: appearance.revision + 1,
      }),

    getBranding: async () => ({ slots: {}, revision: branding.revision }),
    getBrandingConfig: async () => branding,
    saveBranding: (input) =>
      guard("saveBranding", input, {
        slots: { sidebarLogoExpanded: "/api/theme/branding/assets/x.png" },
        revision: branding.revision + 1,
      }),
    resetBranding: (input) =>
      guard("resetBranding", input, {
        slots: { sidebarLogoExpanded: "/brand/logo.png" },
        revision: branding.revision + 1,
      }),
    uploadBrandingAsset: (input) =>
      guard("uploadBrandingAsset", input, {
        fileName: "22222222-2222-4222-8222-222222222222.png",
        mimeType: "image/png",
        bytes: 128,
        uploadedAt: "2026-08-09T00:00:00.000Z",
      }),
    deleteBrandingAsset: (fileName) =>
      guard("deleteBrandingAsset", fileName, { deleted: true }),
    reconcileBrandingAssets: async () => ({ deleted: 0, skipped: 0 }),

    getPresets: async () => presets,
    createPreset: (input) => guard("createPreset", input, presets.presets[0]),
    applyPreset: (input) =>
      guard("applyPreset", input, {
        designConfig: presets.presets[0].designConfig,
        revision: appearance.revision + 1,
      }),
    deletePreset: (id) => guard("deletePreset", id, { id, slug: "winter" }),
  };

  return {
    client,
    calls,
    failNext: (method, error) => failures.set(method, error),
  };
}

export function renderWithProvider(
  ui: React.ReactNode,
  props: Partial<NThemeSettingsProviderProps> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <NThemeSettingsProvider {...props}>{ui}</NThemeSettingsProvider>
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}
