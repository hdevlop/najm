// ============================================================================
// najm-theme/react — the settings provider
// ============================================================================
//
// The feature's whole state machine: queries, drafts, dirty tracking, candidate
// uploads, revision conflicts, and the immediate hand-off to Najm Kit's runtime
// providers so an edit is visible before it is saved.
//
// It is *not* `NajmThemeProvider`. Najm Kit already owns that name for the
// rendering runtime, and the two are genuinely different objects: the kit's
// provider decides what the page looks like right now, and this one decides
// what gets persisted. This nests inside the kit's, writes to it through
// `useNajmDesignEditor` and `useNBrandingEditor`, and replaces neither.
//
// Default consumers never call a hook from this file. The components in
// `../components` are complete on their own; `useNThemeSettings` is exported
// for the surface a consumer builds itself.
// ============================================================================

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useNBrandingEditor, useNajmDesignEditor } from "najm-kit";
import type { NajmDesignConfig } from "najm-kit";

import type { PublicBranding } from "../../contracts/branding";
import { NO_THEME_CAPABILITIES, type NajmThemeFeatures, type ThemeCapabilities } from "../../contracts/capabilities";
import type { PublicThemePreset } from "../../contracts/presets";
import { createThemeClient, type ThemeClient, type ThemeClientOptions } from "../api/client";
import { themeQueryKeys } from "../queryKeys";
import {
  createThemeTranslator,
  type ThemeLabelOverrides,
  type ThemeLanguage,
  type ThemeTranslator,
} from "../translations";
import type {
  AdminAppearanceResponse,
  AdminBrandingResponse,
  BrandingSlotView,
  ThemeDirtyState,
  ThemePresetsResponse,
  ThemeRequestError,
  ThemeSettingsStatus,
} from "../types";

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

export interface NThemeSettingsValue {
  client: ThemeClient;
  features: NajmThemeFeatures;
  capabilities: ThemeCapabilities;
  t: ThemeTranslator;

  loading: boolean;
  status: ThemeSettingsStatus;
  dirty: ThemeDirtyState;

  // Appearance ------------------------------------------------------------
  appearance: AdminAppearanceResponse | undefined;
  /** `draft ?? committed`. What the tree is currently rendered against. */
  design: NajmDesignConfig | undefined;
  factoryDesign: NajmDesignConfig | undefined;
  setDesignDraft: (design: NajmDesignConfig) => void;
  saveAppearance: () => Promise<void>;
  resetAppearance: () => Promise<void>;

  // Branding --------------------------------------------------------------
  branding: AdminBrandingResponse | undefined;
  brandingSlots: BrandingSlotView[];
  uploadBrandingAsset: (slotKey: string, file: File) => Promise<void>;
  clearBrandingSlot: (slotKey: string) => void;
  saveBranding: () => Promise<void>;
  resetBranding: () => Promise<void>;

  // Presets ---------------------------------------------------------------
  presets: PublicThemePreset[];
  presetLimits: ThemePresetsResponse["limits"] | undefined;
  /** `null` means "the stored design", not a preset. */
  selectedPresetId: string | null;
  /** In-memory preview only; nothing is persisted until `applySelectedPreset`. */
  previewPreset: (preset: PublicThemePreset | null) => void;
  applySelectedPreset: () => Promise<void>;
  createPreset: (name: string) => Promise<void>;
  deletePreset: (preset: PublicThemePreset) => Promise<void>;

  // Shared ----------------------------------------------------------------
  discardDrafts: () => Promise<void>;
  reload: () => Promise<void>;
}

const NThemeSettingsContext = React.createContext<NThemeSettingsValue | null>(null);

/**
 * Returns `null` outside a provider rather than throwing, so a component that
 * merely *offers* theme editing stays mountable in an application that has
 * none. Every component in this package renders nothing in that case.
 */
export function useNThemeSettingsOptional(): NThemeSettingsValue | null {
  return React.useContext(NThemeSettingsContext);
}

export function useNThemeSettings(): NThemeSettingsValue {
  const value = React.useContext(NThemeSettingsContext);
  if (!value) {
    throw new Error(
      "useNThemeSettings must be used inside <NThemeSettingsProvider>. Mount the provider once above every theme settings section.",
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface NThemeSettingsProviderProps {
  children: React.ReactNode;
  /** A client from `createThemeClient`, or the options to build one. */
  client?: ThemeClient | ThemeClientOptions;
  /**
   * Which sections may render at all.
   *
   * Defaults to whatever the server reports. Passing it narrows further — a
   * page that only wants the Branding section sets `{ branding: true }` — but
   * it can never widen past what the backend enabled.
   */
  features?: Partial<NajmThemeFeatures>;
  language?: ThemeLanguage | string;
  t?: (key: string, values?: Record<string, string | number>) => string;
  labels?: ThemeLabelOverrides;
  /**
   * Server-rendered snapshot, so the first paint is not a spinner.
   *
   * Seeds the query cache; the queries still run and take over. Pass what
   * `najm-theme/server/react` returned for this request.
   */
  initialData?: {
    appearance?: AdminAppearanceResponse;
    branding?: AdminBrandingResponse;
    presets?: ThemePresetsResponse;
  };
  /**
   * Called after a mutation commits, usually `router.refresh()`.
   *
   * Optional because it is a Next.js concept and this package does not depend
   * on Next. The client providers are already updated by the time this runs, so
   * a consumer that omits it sees the change immediately and picks up the
   * server snapshot on the next navigation.
   */
  onPersisted?: () => void;
  queryClient?: QueryClient;
}

interface BrandingDraftEntry {
  fileName: string | null;
  previewUrl: string | null;
  uploading: boolean;
}

const EMPTY_FEATURES: NajmThemeFeatures = {
  appearance: false,
  branding: false,
  presets: false,
  assetUploads: false,
  mcp: false,
};

export function NThemeSettingsProvider({
  children,
  client: clientProp,
  features: featureOverride,
  language,
  t: translate,
  labels,
  initialData,
  onPersisted,
  queryClient: queryClientProp,
}: NThemeSettingsProviderProps) {
  const client = React.useMemo(
    () =>
      clientProp && typeof (clientProp as ThemeClient).getAppearance === "function"
        ? (clientProp as ThemeClient)
        : createThemeClient(clientProp as ThemeClientOptions | undefined),
    [clientProp],
  );

  const contextQueryClient = useQueryClient(queryClientProp);
  const queryClient = queryClientProp ?? contextQueryClient;

  const t = React.useMemo(
    () => createThemeTranslator({ language, t: translate, overrides: labels }),
    [language, translate, labels],
  );

  // The kit's runtime providers. Both optional: a settings page mounted outside
  // `NajmAppProvider` still edits and saves, it just cannot live-preview.
  const designEditor = useNajmDesignEditor();
  const brandingEditor = useNBrandingEditor();

  const [status, setStatus] = React.useState<ThemeSettingsStatus>({
    phase: "idle",
    lastAction: null,
    error: null,
    conflict: null,
  });
  const [designDraft, setDesignDraft] = React.useState<NajmDesignConfig | null>(null);
  const [brandingDraft, setBrandingDraft] = React.useState<Record<string, BrandingDraftEntry>>({});
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(null);

  // Candidates uploaded during this editing session. Tracked so cancelling a
  // draft can clean them up instead of leaving them for the grace-period sweep.
  const candidateFileNames = React.useRef<Set<string>>(new Set());

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  const wantAppearance = featureOverride?.appearance !== false;
  const wantBranding = featureOverride?.branding !== false;
  const wantPresets = featureOverride?.presets !== false;

  const appearanceQuery = useQuery({
    queryKey: themeQueryKeys.appearanceConfig(client.baseUrl),
    queryFn: ({ signal }) => client.getAppearanceConfig(signal),
    enabled: wantAppearance,
    initialData: initialData?.appearance,
    // A settings screen is opened deliberately and read for minutes. Refetching
    // on window focus while somebody is mid-edit would swap the committed
    // revision under an open draft, which is the conflict this package exists
    // to report rather than to cause.
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error as ThemeRequestError).conflict && count < 2,
  });

  const brandingQuery = useQuery({
    queryKey: themeQueryKeys.brandingConfig(client.baseUrl),
    queryFn: ({ signal }) => client.getBrandingConfig(signal),
    enabled: wantBranding,
    initialData: initialData?.branding,
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error as ThemeRequestError).conflict && count < 2,
  });

  const serverFeatures =
    appearanceQuery.data?.features ?? brandingQuery.data?.features ?? EMPTY_FEATURES;

  const features = React.useMemo<NajmThemeFeatures>(
    () => ({
      // The server's answer is the ceiling. A page may narrow what it shows; it
      // cannot enable a section the backend did not register, because the
      // routes behind it would not exist.
      appearance: serverFeatures.appearance && featureOverride?.appearance !== false,
      branding: serverFeatures.branding && featureOverride?.branding !== false,
      presets: serverFeatures.presets && featureOverride?.presets !== false,
      assetUploads: serverFeatures.assetUploads && featureOverride?.assetUploads !== false,
      mcp: serverFeatures.mcp,
    }),
    [serverFeatures, featureOverride],
  );

  const presetsQuery = useQuery({
    queryKey: themeQueryKeys.presets(client.baseUrl),
    queryFn: ({ signal }) => client.getPresets(signal),
    enabled: wantPresets && features.presets,
    initialData: initialData?.presets,
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error as ThemeRequestError).conflict && count < 2,
  });

  const capabilities =
    appearanceQuery.data?.capabilities ?? brandingQuery.data?.capabilities ?? NO_THEME_CAPABILITIES;

  // ---------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------

  const committedDesign = appearanceQuery.data?.designConfig;
  const design = designDraft ?? committedDesign;

  const appearanceDirty =
    designDraft !== null
    && committedDesign !== undefined
    && JSON.stringify(designDraft) !== JSON.stringify(committedDesign);

  const brandingDirty = Object.values(brandingDraft).some(
    (entry) => !entry.uploading && (entry.fileName !== null || entry.previewUrl === null),
  );

  const dirty = React.useMemo<ThemeDirtyState>(
    () => ({
      appearance: appearanceDirty,
      branding: brandingDirty,
      any: appearanceDirty || brandingDirty,
    }),
    [appearanceDirty, brandingDirty],
  );

  const brandingSlots = React.useMemo<BrandingSlotView[]>(() => {
    const slots = brandingQuery.data?.slots ?? [];
    return slots.map((slot) => {
      const draft = brandingDraft[slot.key];
      const pendingCleared = draft !== undefined && draft.fileName === null && !draft.uploading;
      return {
        ...slot,
        pendingPreviewUrl: draft?.previewUrl ?? null,
        pendingFileName: draft?.fileName ?? null,
        pendingCleared,
        uploading: draft?.uploading ?? false,
        previewAspect: slot.previewAspect,
        displayPath: draft
          ? (draft.previewUrl ?? (pendingCleared ? null : slot.resolvedPath))
          : slot.resolvedPath,
      };
    });
  }, [brandingQuery.data, brandingDraft]);

  // ---------------------------------------------------------------------
  // Runtime preview
  // ---------------------------------------------------------------------

  // Every design change — a customizer edit or a preset preview — reaches the
  // rendering provider here, in one effect, rather than at each call site. That
  // is what makes "the page restyles as you drag the colour" true without any
  // component knowing about the runtime.
  React.useEffect(() => {
    if (!designEditor) return;
    if (designDraft) designEditor.setDraft(designDraft);
    else if (committedDesign) designEditor.setCommitted(committedDesign);
  }, [designEditor, designDraft, committedDesign]);

  // Object URLs are revoked when the draft that owns them goes away. Without
  // this a long editing session leaks every preview the user cycled through.
  React.useEffect(
    () => () => {
      for (const entry of Object.values(brandingDraft)) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
    },
    // Intentionally only on unmount: the individual revokes happen where an
    // entry is replaced, and depending on `brandingDraft` here would revoke a
    // URL the very render that created it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const publishBranding = React.useCallback(
    (branding: PublicBranding) => {
      brandingEditor?.setBranding({
        sidebarLogoExpandedPath: branding.slots.sidebarLogoExpanded ?? null,
        sidebarLogoCollapsedPath: branding.slots.sidebarLogoCollapsed ?? null,
      });
    },
    [brandingEditor],
  );

  // ---------------------------------------------------------------------
  // Mutation plumbing
  // ---------------------------------------------------------------------

  const invalidate = React.useCallback(
    async (...keys: readonly (readonly unknown[])[]) => {
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    [queryClient],
  );

  const runMutation = React.useCallback(
    async <T,>(
      phase: "saving" | "resetting",
      resource: "appearance" | "branding",
      body: () => Promise<T>,
      onDone: (result: T) => Promise<void> | void,
      lastAction: ThemeSettingsStatus["lastAction"],
    ): Promise<void> => {
      setStatus({ phase, lastAction: null, error: null, conflict: null });
      try {
        const result = await body();
        await onDone(result);
        setStatus({ phase: "idle", lastAction, error: null, conflict: null });
        onPersisted?.();
      } catch (cause) {
        const error = cause as ThemeRequestError;
        // A conflict means the local revision is stale, so the resource is
        // refetched immediately: the next save attempt then carries the current
        // revision, and the UI can show what it actually is.
        if (error.conflict) {
          await invalidate(
            resource === "appearance"
              ? themeQueryKeys.appearanceConfig(client.baseUrl)
              : themeQueryKeys.brandingConfig(client.baseUrl),
          );
        }
        setStatus({
          phase: "error",
          lastAction: null,
          error,
          conflict: error.conflict ? resource : null,
        });
        throw error;
      }
    },
    [client.baseUrl, invalidate, onPersisted],
  );

  // ---------------------------------------------------------------------
  // Commands — appearance
  // ---------------------------------------------------------------------

  const setDesignDraftCommand = React.useCallback((next: NajmDesignConfig) => {
    // A hand edit is a departure from whatever preset was being previewed, so
    // the selection is dropped rather than left pointing at a design the user
    // has since changed.
    setSelectedPresetId(null);
    setDesignDraft(next);
  }, []);

  const saveAppearanceMutation = useMutation({
    mutationFn: (input: { expectedRevision: number; designConfig: NajmDesignConfig }) =>
      client.saveAppearance(input),
  });

  const saveAppearance = React.useCallback(async () => {
    if (!designDraft || !appearanceQuery.data) return;
    const expectedRevision = appearanceQuery.data.revision;

    await runMutation(
      "saving",
      "appearance",
      () => saveAppearanceMutation.mutateAsync({ expectedRevision, designConfig: designDraft }),
      async (saved) => {
        setDesignDraft(null);
        designEditor?.setCommitted(saved.designConfig);
        await invalidate(themeQueryKeys.appearanceConfig(client.baseUrl));
      },
      "appearance-saved",
    );
  }, [appearanceQuery.data, client.baseUrl, designDraft, designEditor, invalidate, runMutation, saveAppearanceMutation]);

  const resetAppearanceMutation = useMutation({
    mutationFn: (input: { expectedRevision: number }) => client.resetAppearance(input),
  });

  const resetAppearance = React.useCallback(async () => {
    if (!appearanceQuery.data) return;

    await runMutation(
      "resetting",
      "appearance",
      () => resetAppearanceMutation.mutateAsync({ expectedRevision: appearanceQuery.data!.revision }),
      async (reset) => {
        setDesignDraft(null);
        setSelectedPresetId(null);
        designEditor?.setCommitted(reset.designConfig);
        await invalidate(themeQueryKeys.appearanceConfig(client.baseUrl));
      },
      "reset",
    );
  }, [appearanceQuery.data, client.baseUrl, designEditor, invalidate, resetAppearanceMutation, runMutation]);

  // ---------------------------------------------------------------------
  // Commands — branding
  // ---------------------------------------------------------------------

  const uploadBrandingAsset = React.useCallback(
    async (slotKey: string, file: File) => {
      const previewUrl = URL.createObjectURL(file);

      setBrandingDraft((current) => {
        const previous = current[slotKey];
        if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        return { ...current, [slotKey]: { fileName: null, previewUrl, uploading: true } };
      });
      setStatus((current) => ({ ...current, phase: "saving", error: null }));

      try {
        const asset = await client.uploadBrandingAsset({ slot: slotKey, file });
        candidateFileNames.current.add(asset.fileName);
        setBrandingDraft((current) => ({
          ...current,
          [slotKey]: { fileName: asset.fileName, previewUrl, uploading: false },
        }));
        setStatus((current) => ({ ...current, phase: "idle" }));
      } catch (cause) {
        // The failed candidate is removed rather than left in place: an entry
        // with no file name would make the slot look dirty and then fail again
        // at save with a much less specific message.
        URL.revokeObjectURL(previewUrl);
        setBrandingDraft((current) => {
          const next = { ...current };
          delete next[slotKey];
          return next;
        });
        setStatus({
          phase: "error",
          lastAction: null,
          error: cause as ThemeRequestError,
          conflict: null,
        });
        throw cause;
      }
    },
    [client],
  );

  const clearBrandingSlot = React.useCallback((slotKey: string) => {
    setBrandingDraft((current) => {
      const previous = current[slotKey];
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      return { ...current, [slotKey]: { fileName: null, previewUrl: null, uploading: false } };
    });
  }, []);

  const saveBrandingMutation = useMutation({
    mutationFn: (input: {
      expectedRevision: number;
      slots: Record<string, { fileName: string } | null>;
      discardFileNames?: string[];
    }) => client.saveBranding(input),
  });

  const saveBranding = React.useCallback(async () => {
    if (!brandingQuery.data) return;

    const slots: Record<string, { fileName: string } | null> = {};
    const committing = new Set<string>();
    for (const [key, entry] of Object.entries(brandingDraft)) {
      if (entry.uploading) continue;
      slots[key] = entry.fileName ? { fileName: entry.fileName } : null;
      if (entry.fileName) committing.add(entry.fileName);
    }
    if (Object.keys(slots).length === 0) return;

    // Candidates from this session that no slot ended up using. Sent with the
    // save so the server deletes them in the same round trip rather than
    // leaving them for the grace-period sweep.
    const discardFileNames = [...candidateFileNames.current].filter(
      (fileName) => !committing.has(fileName),
    );

    await runMutation(
      "saving",
      "branding",
      () =>
        saveBrandingMutation.mutateAsync({
          expectedRevision: brandingQuery.data!.revision,
          slots,
          discardFileNames,
        }),
      async (saved) => {
        for (const entry of Object.values(brandingDraft)) {
          if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
        }
        setBrandingDraft({});
        candidateFileNames.current.clear();
        publishBranding(saved);
        await invalidate(themeQueryKeys.brandingConfig(client.baseUrl));
      },
      "branding-saved",
    );
  }, [brandingDraft, brandingQuery.data, client.baseUrl, invalidate, publishBranding, runMutation, saveBrandingMutation]);

  const resetBrandingMutation = useMutation({
    mutationFn: (input: { expectedRevision: number }) => client.resetBranding(input),
  });

  const resetBranding = React.useCallback(async () => {
    if (!brandingQuery.data) return;

    await runMutation(
      "resetting",
      "branding",
      () => resetBrandingMutation.mutateAsync({ expectedRevision: brandingQuery.data!.revision }),
      async (reset) => {
        for (const entry of Object.values(brandingDraft)) {
          if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
        }
        setBrandingDraft({});
        publishBranding(reset);
        await invalidate(themeQueryKeys.brandingConfig(client.baseUrl));
      },
      "reset",
    );
  }, [brandingDraft, brandingQuery.data, client.baseUrl, invalidate, publishBranding, resetBrandingMutation, runMutation]);

  // ---------------------------------------------------------------------
  // Commands — presets
  // ---------------------------------------------------------------------

  /**
   * Preview only. Nothing is written until `applySelectedPreset`.
   *
   * The design goes into the same draft a hand edit uses, so previewing a
   * preset and then adjusting one token is a single continuous edit rather than
   * two competing sources of truth.
   */
  const previewPreset = React.useCallback(
    (preset: PublicThemePreset | null) => {
      setSelectedPresetId(preset?.id ?? null);
      setDesignDraft(preset ? structuredClone(preset.designConfig) : null);
    },
    [],
  );

  const applyPresetMutation = useMutation({
    mutationFn: (input: { id: string; expectedRevision: number }) => client.applyPreset(input),
  });

  const applySelectedPreset = React.useCallback(async () => {
    if (!selectedPresetId || !appearanceQuery.data) return;

    await runMutation(
      "saving",
      "appearance",
      () =>
        applyPresetMutation.mutateAsync({
          id: selectedPresetId,
          expectedRevision: appearanceQuery.data!.revision,
        }),
      async (applied) => {
        setDesignDraft(null);
        setSelectedPresetId(null);
        designEditor?.setCommitted(applied.designConfig);
        await invalidate(themeQueryKeys.appearanceConfig(client.baseUrl));
      },
      "preset-applied",
    );
  }, [appearanceQuery.data, applyPresetMutation, client.baseUrl, designEditor, invalidate, runMutation, selectedPresetId]);

  const createPresetMutation = useMutation({
    mutationFn: (input: { name: string; designConfig: NajmDesignConfig }) =>
      client.createPreset(input),
  });

  const createPreset = React.useCallback(
    async (name: string) => {
      const designConfig = designDraft ?? committedDesign;
      if (!designConfig) return;

      setStatus((current) => ({ ...current, phase: "saving", error: null }));
      try {
        await createPresetMutation.mutateAsync({ name, designConfig });
        await invalidate(themeQueryKeys.presets(client.baseUrl));
        setStatus({ phase: "idle", lastAction: null, error: null, conflict: null });
      } catch (cause) {
        setStatus({
          phase: "error",
          lastAction: null,
          error: cause as ThemeRequestError,
          conflict: null,
        });
        throw cause;
      }
    },
    [client.baseUrl, committedDesign, createPresetMutation, designDraft, invalidate],
  );

  const deletePresetMutation = useMutation({
    mutationFn: (id: string) => client.deletePreset(id),
  });

  const deletePreset = React.useCallback(
    async (preset: PublicThemePreset) => {
      setStatus((current) => ({ ...current, phase: "saving", error: null }));
      try {
        await deletePresetMutation.mutateAsync(preset.id);
        if (selectedPresetId === preset.id) previewPreset(null);
        await invalidate(themeQueryKeys.presets(client.baseUrl));
        setStatus({ phase: "idle", lastAction: null, error: null, conflict: null });
      } catch (cause) {
        setStatus({
          phase: "error",
          lastAction: null,
          error: cause as ThemeRequestError,
          conflict: null,
        });
        throw cause;
      }
    },
    [client.baseUrl, deletePresetMutation, invalidate, previewPreset, selectedPresetId],
  );

  // ---------------------------------------------------------------------
  // Shared commands
  // ---------------------------------------------------------------------

  /**
   * Drops every local edit and cleans up the uploads it created.
   *
   * The deletes are best effort and deliberately not awaited into a failure: a
   * candidate that survives is an orphan the grace-period sweep will collect,
   * and telling the user their cancel "failed" would be both alarming and
   * untrue — the draft *is* gone.
   */
  const discardDrafts = React.useCallback(async () => {
    setDesignDraft(null);
    setSelectedPresetId(null);

    for (const entry of Object.values(brandingDraft)) {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    }
    setBrandingDraft({});
    designEditor?.cancelDraft();

    const abandoned = [...candidateFileNames.current];
    candidateFileNames.current.clear();
    await Promise.allSettled(abandoned.map((fileName) => client.deleteBrandingAsset(fileName)));

    setStatus({ phase: "idle", lastAction: null, error: null, conflict: null });
  }, [brandingDraft, client, designEditor]);

  const reload = React.useCallback(async () => {
    await invalidate(
      themeQueryKeys.appearanceConfig(client.baseUrl),
      themeQueryKeys.brandingConfig(client.baseUrl),
      themeQueryKeys.presets(client.baseUrl),
    );
    setStatus({ phase: "idle", lastAction: null, error: null, conflict: null });
  }, [client.baseUrl, invalidate]);

  const loading =
    (wantAppearance && appearanceQuery.isPending)
    || (wantBranding && brandingQuery.isPending)
    || (wantPresets && features.presets && presetsQuery.isPending);

  const loadError =
    (appearanceQuery.error as ThemeRequestError | null)
    ?? (brandingQuery.error as ThemeRequestError | null)
    ?? (presetsQuery.error as ThemeRequestError | null)
    ?? null;

  const value = React.useMemo<NThemeSettingsValue>(
    () => ({
      client,
      features,
      capabilities,
      t,
      loading,
      status: status.error ? status : { ...status, error: loadError, phase: loadError ? "error" : status.phase },
      dirty,
      appearance: appearanceQuery.data,
      design,
      factoryDesign: appearanceQuery.data?.isFactory ? appearanceQuery.data.designConfig : undefined,
      setDesignDraft: setDesignDraftCommand,
      saveAppearance,
      resetAppearance,
      branding: brandingQuery.data,
      brandingSlots,
      uploadBrandingAsset,
      clearBrandingSlot,
      saveBranding,
      resetBranding,
      presets: presetsQuery.data?.presets ?? [],
      presetLimits: presetsQuery.data?.limits,
      selectedPresetId,
      previewPreset,
      applySelectedPreset,
      createPreset,
      deletePreset,
      discardDrafts,
      reload,
    }),
    [
      appearanceQuery.data,
      applySelectedPreset,
      brandingQuery.data,
      brandingSlots,
      capabilities,
      clearBrandingSlot,
      client,
      createPreset,
      deletePreset,
      design,
      dirty,
      discardDrafts,
      features,
      loadError,
      loading,
      presetsQuery.data,
      previewPreset,
      reload,
      resetAppearance,
      resetBranding,
      saveAppearance,
      saveBranding,
      selectedPresetId,
      setDesignDraftCommand,
      status,
      t,
      uploadBrandingAsset,
    ],
  );

  return (
    <NThemeSettingsContext.Provider value={value}>{children}</NThemeSettingsContext.Provider>
  );
}
