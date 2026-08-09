// ============================================================================
// najm-theme/react — the typed transport
// ============================================================================
//
// One client, so a consumer never writes `fetch("/api/theme/appearance")` and
// then has to remember the envelope, the credentials mode, the conflict code,
// and which errors are worth retrying.
//
// It is a plain object rather than a class with a base URL baked into a
// singleton, because a page can legitimately hold two — a platform console and
// a tenant preview — and the query keys are scoped by base URL for the same
// reason.
// ============================================================================

import type {
  NajmDesignConfig,
  PublicAppearance,
  PublicBranding,
  PublicThemePreset,
} from "../../contracts";
import type {
  AdminAppearanceResponse,
  AdminBrandingResponse,
  ThemePresetsResponse,
  ThemeRequestError,
  UploadedBrandingAsset,
} from "../types";

/** Matches `THEME_CONFLICT_CODE` on the server. Duplicated, not imported: */
/* the server entry must never be reachable from a client bundle. */
const CONFLICT_CODE = "THEME_REVISION_CONFLICT";

export interface ThemeClientOptions {
  /**
   * Where the theme routes are mounted as the browser sees them, e.g.
   * `/api/theme`. No trailing slash.
   */
  baseUrl?: string;
  /**
   * Extra headers per request — an `Authorization` bearer, a tenant header.
   *
   * A function, not an object, so a token that rotates is read at call time
   * rather than captured when the provider mounted.
   */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Defaults to `"same-origin"`. */
  credentials?: RequestCredentials;
  /** Swapped in tests. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export interface ThemeClient {
  baseUrl: string;
  getAppearance(signal?: AbortSignal): Promise<PublicAppearance>;
  getAppearanceConfig(signal?: AbortSignal): Promise<AdminAppearanceResponse>;
  saveAppearance(input: {
    expectedRevision: number;
    designConfig: Partial<NajmDesignConfig>;
  }): Promise<PublicAppearance>;
  resetAppearance(input: { expectedRevision: number }): Promise<PublicAppearance>;

  getBranding(signal?: AbortSignal): Promise<PublicBranding>;
  getBrandingConfig(signal?: AbortSignal): Promise<AdminBrandingResponse>;
  saveBranding(input: {
    expectedRevision: number;
    slots: Record<string, { fileName: string } | null>;
    discardFileNames?: string[];
  }): Promise<PublicBranding>;
  resetBranding(input: { expectedRevision: number }): Promise<PublicBranding>;
  uploadBrandingAsset(input: {
    slot: string;
    file: File;
    signal?: AbortSignal;
  }): Promise<UploadedBrandingAsset>;
  deleteBrandingAsset(fileName: string): Promise<{ deleted: boolean }>;
  reconcileBrandingAssets(): Promise<{ deleted: number; skipped: number }>;

  getPresets(signal?: AbortSignal): Promise<ThemePresetsResponse>;
  createPreset(input: { name: string; designConfig: NajmDesignConfig }): Promise<PublicThemePreset>;
  applyPreset(input: { id: string; expectedRevision: number }): Promise<PublicAppearance>;
  deletePreset(id: string): Promise<{ id: string; slug: string }>;
}

function themeError(message: string, status: number, code?: string): ThemeRequestError {
  const error = new Error(message) as ThemeRequestError;
  error.name = "ThemeRequestError";
  error.status = status;
  error.code = code;
  error.conflict = code === CONFLICT_CODE || status === 409;
  return error;
}

export function isThemeConflictError(error: unknown): error is ThemeRequestError {
  return error instanceof Error && (error as ThemeRequestError).conflict === true;
}

/**
 * Najm's `{ data }` envelope, unwrapped once here.
 *
 * A response with no `data` key is passed through rather than rejected: a
 * consumer that turned auto-wrapping off is not misconfigured, and the parse
 * downstream is what decides whether the payload is usable.
 */
function unwrap(payload: unknown): unknown {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

export function createThemeClient(options: ThemeClientOptions = {}): ThemeClient {
  const baseUrl = (options.baseUrl ?? "/api/theme").replace(/\/+$/, "");
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const credentials = options.credentials ?? "same-origin";

  async function request<T>(
    path: string,
    init: RequestInit & { json?: unknown } = {},
  ): Promise<T> {
    const { json, ...rest } = init;
    const headers = new Headers(rest.headers);

    for (const [key, value] of Object.entries((await options.headers?.()) ?? {})) {
      headers.set(key, value);
    }
    if (json !== undefined) headers.set("Content-Type", "application/json");

    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        ...rest,
        credentials,
        headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });
    } catch (cause) {
      // Status 0 for "the request never reached a server": a component can then
      // offer "try again" rather than a message about the theme being invalid.
      throw themeError(cause instanceof Error ? cause.message : "network request failed", 0);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      const body = (payload ?? {}) as { message?: string; code?: string; error?: string };
      throw themeError(
        body.message ?? body.error ?? `request failed with status ${response.status}`,
        response.status,
        body.code,
      );
    }

    return unwrap(payload) as T;
  }

  return {
    baseUrl,

    getAppearance: (signal) => request("/appearance", { method: "GET", signal }),
    getAppearanceConfig: (signal) => request("/appearance/config", { method: "GET", signal }),
    saveAppearance: (input) => request("/appearance", { method: "PUT", json: input }),
    resetAppearance: (input) => request("/appearance/reset", { method: "POST", json: input }),

    getBranding: (signal) => request("/branding", { method: "GET", signal }),
    getBrandingConfig: (signal) => request("/branding/config", { method: "GET", signal }),
    saveBranding: (input) => request("/branding", { method: "PUT", json: input }),
    resetBranding: (input) => request("/branding/reset", { method: "POST", json: input }),

    /**
     * Raw bytes with the file's own `Content-Type`, not `FormData`.
     *
     * The server re-derives the real type from the magic bytes either way, so
     * the multipart envelope would buy nothing and cost a parse — and the
     * file's name is in the path where an access log can show it.
     */
    uploadBrandingAsset: ({ slot, file, signal }) =>
      request(
        `/branding/assets/${encodeURIComponent(slot)}/${encodeURIComponent(file.name || "upload")}`,
        {
          method: "POST",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
          signal,
        },
      ),

    deleteBrandingAsset: (fileName) =>
      request(`/branding/assets/${encodeURIComponent(fileName)}`, { method: "DELETE" }),

    reconcileBrandingAssets: () => request("/branding/assets/reconcile", { method: "POST" }),

    getPresets: (signal) => request("/presets", { method: "GET", signal }),
    createPreset: (input) => request("/presets", { method: "POST", json: input }),
    applyPreset: ({ id, expectedRevision }) =>
      request(`/presets/${encodeURIComponent(id)}/apply`, {
        method: "POST",
        json: { expectedRevision },
      }),
    deletePreset: (id) => request(`/presets/${encodeURIComponent(id)}`, { method: "DELETE" }),
  };
}
