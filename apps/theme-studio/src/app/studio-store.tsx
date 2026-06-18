import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  composePreset,
  type NajmComponentName,
  type NajmComponentStyleConfig,
  type NajmDesignConfig,
  type NajmThemeTokens,
  type NajmTypographyConfig,
} from "najm-kit";
import { DEFAULT_PRESET, PRESETS, SMS_DASHBOARD_PRESET_ID } from "../theme/presets";
import { type TokenCategoryId, type TokenKey } from "../theme/token-meta";

export type SettingsTab =
  | "colors"
  | "typography"
  | "layout"
  | "charts"
  | "components"
  | "export";
export type PreviewId =
  | "dashboard"
  | "components"
  | "forms"
  | "data"
  | "overlays"
  | "charts";
const STORAGE_CURRENT = "najm-theme-studio/current";
const STORAGE_SAVED = "najm-theme-studio/saved";
const STORAGE_SAVED_SEEDS = "najm-theme-studio/saved-seeds";
const STORAGE_PREVIEW_LAYOUT = "najm-theme-studio/preview-layout";
const SMS_SAVED_THEME_ID = "seed-sms-dashboard";
const SMS_SAVED_THEME_DATE = "2026-06-18T00:00:00.000Z";

/** Preview layout controls exported as NajmDesignConfig.layout. */
export interface PreviewLayout {
  gutter: number;
  gap: number;
}

const DEFAULT_PREVIEW_LAYOUT: PreviewLayout = { gutter: 24, gap: 20 };

export interface SavedTheme {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: NajmDesignConfig;
}

interface StudioState {
  config: NajmDesignConfig;
  selectedPresetId?: string;
  activeSettingsTab: SettingsTab;
  activeTokenCategory: TokenCategoryId;
  preview: PreviewId;
  previewLayout: PreviewLayout;
  selectedComponent?: NajmComponentName;
  flyoutOpen: boolean;
  dirty: boolean;
}

interface StudioActions {
  setToken: (key: TokenKey, value: string) => void;
  resetToken: (key: TokenKey) => void;
  setThemeField: <K extends keyof NajmDesignConfig["theme"]>(key: K, value: NajmDesignConfig["theme"][K]) => void;
  /** Switches mode AND re-resolves the token palette for that mode + current accent. */
  setMode: (mode: "light" | "dark") => void;
  /** Switches accent AND re-resolves the token palette for that mode + new accent. */
  setAccent: (accent: NajmDesignConfig["theme"]["accent"]) => void;
  setBorderWidth: (value: string) => void;
  setSpacing: (value: string) => void;
  setTypography: (patch: Partial<NajmTypographyConfig>) => void;
  setComponentConfig: (name: NajmComponentName, patch: Partial<NajmComponentStyleConfig>) => void;
  setComponentVariantAlias: (name: NajmComponentName, variant: string, use: string | undefined) => void;
  resetComponent: (name: NajmComponentName) => void;
  loadPreset: (id: string) => void;
  importConfig: (config: NajmDesignConfig) => void;
  setTab: (tab: SettingsTab) => void;
  setTokenCategory: (cat: TokenCategoryId) => void;
  setPreview: (p: PreviewId) => void;
  setPreviewGutter: (value: number) => void;
  setPreviewGap: (value: number) => void;
  resetPreviewLayout: () => void;
  selectComponent: (name: NajmComponentName | undefined) => void;
  openFlyout: (name: NajmComponentName) => void;
  closeFlyout: () => void;
  // persistence
  saved: SavedTheme[];
  saveTheme: (name: string) => void;
  duplicateTheme: (id: string) => void;
  deleteTheme: (id: string) => void;
  loadSaved: (id: string) => void;
}

type Store = StudioState & StudioActions;

const StudioContext = createContext<Store | null>(null);

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function loadInitial(): NajmDesignConfig {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return clone(DEFAULT_PRESET.config);
}

function readSavedSeedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_SEEDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeSavedSeedIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_SAVED_SEEDS, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function seedSavedThemes(saved: SavedTheme[]): SavedTheme[] {
  const smsPreset = PRESETS.find((preset) => preset.id === SMS_DASHBOARD_PRESET_ID);
  if (!smsPreset) return saved;

  const seedIds = readSavedSeedIds();
  if (saved.some((theme) => theme.id === SMS_SAVED_THEME_ID || theme.name === smsPreset.name)) {
    if (!seedIds.includes(SMS_SAVED_THEME_ID)) writeSavedSeedIds([...seedIds, SMS_SAVED_THEME_ID]);
    return saved;
  }

  if (seedIds.includes(SMS_SAVED_THEME_ID)) return saved;
  writeSavedSeedIds([...seedIds, SMS_SAVED_THEME_ID]);

  return [
    {
      id: SMS_SAVED_THEME_ID,
      name: smsPreset.name,
      createdAt: SMS_SAVED_THEME_DATE,
      updatedAt: SMS_SAVED_THEME_DATE,
      config: clone(smsPreset.config),
    },
    ...saved,
  ];
}

function loadSavedList(): SavedTheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return seedSavedThemes(parsed);
    }
  } catch {
    /* ignore */
  }
  return seedSavedThemes([]);
}

function clampSpace(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(64, Math.round(n)));
}

function loadPreviewLayout(): PreviewLayout {
  try {
    const raw = localStorage.getItem(STORAGE_PREVIEW_LAYOUT);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PreviewLayout>;
      return {
        gutter: clampSpace(parsed.gutter, DEFAULT_PREVIEW_LAYOUT.gutter),
        gap: clampSpace(parsed.gap, DEFAULT_PREVIEW_LAYOUT.gap),
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PREVIEW_LAYOUT;
}

function previewLayoutFromConfig(config: NajmDesignConfig, fallback = loadPreviewLayout()): PreviewLayout {
  return {
    gutter: clampSpace(parseFloat(config.layout?.pageGutter ?? ""), fallback.gutter),
    gap: clampSpace(parseFloat(config.layout?.sectionGap ?? ""), fallback.gap),
  };
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<NajmDesignConfig>(loadInitial);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(DEFAULT_PRESET.id);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("colors");
  const [activeTokenCategory, setActiveTokenCategory] = useState<TokenCategoryId>("foundation");
  const [preview, setPreviewState] = useState<PreviewId>("dashboard");
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>(() => previewLayoutFromConfig(config));
  const [selectedComponent, setSelectedComponent] = useState<NajmComponentName | undefined>();
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<SavedTheme[]>(loadSavedList);

  // Auto-save current draft (debounced via rAF-ish microtask).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_CURRENT, JSON.stringify(config));
    } catch {
      /* ignore */
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SAVED, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, [saved]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREVIEW_LAYOUT, JSON.stringify(previewLayout));
    } catch {
      /* ignore */
    }
  }, [previewLayout]);

  const mutateTheme = useCallback((fn: (t: NajmDesignConfig["theme"]) => void) => {
    setConfig((prev) => {
      const next = clone(prev);
      fn(next.theme);
      return next;
    });
    setDirty(true);
  }, []);

  const setToken = useCallback(
    (key: TokenKey, value: string) => {
      mutateTheme((theme) => {
        theme.tokens = { ...(theme.tokens ?? {}) } as NajmThemeTokens;
        (theme.tokens as Record<string, string>)[key] = value;
      });
    },
    [mutateTheme],
  );

  const resetToken = useCallback(
    (key: TokenKey) => {
      mutateTheme((theme) => {
        if (theme.tokens) {
          const next = { ...theme.tokens } as Record<string, string>;
          delete next[key];
          theme.tokens = next as NajmThemeTokens;
        }
      });
    },
    [mutateTheme],
  );

  const setThemeField = useCallback(
    <K extends keyof NajmDesignConfig["theme"]>(key: K, value: NajmDesignConfig["theme"][K]) => {
      mutateTheme((theme) => {
        theme[key] = value;
      });
    },
    [mutateTheme],
  );

  const setMode = useCallback(
    (mode: "light" | "dark") => {
      mutateTheme((theme) => {
        theme.mode = mode;
        // Regenerate the palette for the new mode so the toggle actually recolors.
        theme.tokens = { ...composePreset(mode, theme.accent ?? "neutral") } as NajmThemeTokens;
      });
    },
    [mutateTheme],
  );

  const setAccent = useCallback(
    (accent: NajmDesignConfig["theme"]["accent"]) => {
      mutateTheme((theme) => {
        theme.accent = accent;
        // Regenerate the palette so accent-derived tokens (primary, ring,
        // sidebar-primary, sidebar-ring) actually update in the preview.
        theme.tokens = { ...composePreset(theme.mode ?? "light", accent ?? "neutral") } as NajmThemeTokens;
      });
    },
    [mutateTheme],
  );

  const setBorderWidth = useCallback(
    (value: string) => {
      mutateTheme((theme) => {
        theme.appearance = { ...(theme.appearance ?? {}), borderWidth: value };
      });
    },
    [mutateTheme],
  );

  const setSpacing = useCallback(
    (value: string) => {
      mutateTheme((theme) => {
        theme.spacing = value;
      });
    },
    [mutateTheme],
  );

  const setPreviewGutter = useCallback((value: number) => {
    const gutter = clampSpace(value, DEFAULT_PREVIEW_LAYOUT.gutter);
    setPreviewLayout((prev) => ({ ...prev, gutter }));
    setConfig((prev) => ({
      ...prev,
      layout: { ...(prev.layout ?? {}), pageGutter: `${gutter}px` },
    }));
    setDirty(true);
  }, []);

  const setPreviewGap = useCallback((value: number) => {
    const gap = clampSpace(value, DEFAULT_PREVIEW_LAYOUT.gap);
    setPreviewLayout((prev) => ({ ...prev, gap }));
    setConfig((prev) => ({
      ...prev,
      layout: { ...(prev.layout ?? {}), sectionGap: `${gap}px` },
    }));
    setDirty(true);
  }, []);

  const resetPreviewLayout = useCallback(() => {
    setPreviewLayout(DEFAULT_PREVIEW_LAYOUT);
    setConfig((prev) => ({
      ...prev,
      layout: {
        ...(prev.layout ?? {}),
        pageGutter: `${DEFAULT_PREVIEW_LAYOUT.gutter}px`,
        sectionGap: `${DEFAULT_PREVIEW_LAYOUT.gap}px`,
      },
    }));
    setDirty(true);
  }, []);

  const setTypography = useCallback((patch: Partial<NajmTypographyConfig>) => {
    setConfig((prev) => {
      const next = clone(prev);
      next.typography = { ...(next.typography ?? {}), ...patch };
      return next;
    });
    setDirty(true);
  }, []);

  const setComponentConfig = useCallback(
    (name: NajmComponentName, patch: Partial<NajmComponentStyleConfig>) => {
      setConfig((prev) => {
        const next = clone(prev);
        next.components = { ...(next.components ?? {}) };
        const component = { ...(next.components[name] ?? {}) } as Record<string, unknown>;
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined || value === "") {
            delete component[key];
          } else {
            component[key] = value;
          }
        }
        if (Object.keys(component).length > 0) {
          next.components[name] = component as NajmComponentStyleConfig;
        } else {
          delete next.components[name];
        }
        return next;
      });
      setDirty(true);
    },
    [],
  );

  const setComponentVariantAlias = useCallback(
    (name: NajmComponentName, variant: string, use: string | undefined) => {
      setConfig((prev) => {
        const next = clone(prev);
        next.components = { ...(next.components ?? {}) };
        const comp = { ...(next.components[name] ?? {}) };
        const variants = { ...(comp.variants ?? {}) };
        if (use && use !== variant) {
          variants[variant] = { ...(variants[variant] ?? {}), use };
        } else {
          delete variants[variant];
        }
        comp.variants = variants;
        next.components[name] = comp;
        return next;
      });
      setDirty(true);
    },
    [],
  );

  const resetComponent = useCallback((name: NajmComponentName) => {
    setConfig((prev) => {
      const next = clone(prev);
      if (next.components) {
        const c = { ...next.components };
        delete c[name];
        next.components = c;
      }
      return next;
    });
    setDirty(true);
  }, []);

  const loadPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setConfig(clone(preset.config));
    setPreviewLayout(previewLayoutFromConfig(preset.config, DEFAULT_PREVIEW_LAYOUT));
    setSelectedPresetId(id);
    setDirty(false);
  }, []);

  const importConfig = useCallback((cfg: NajmDesignConfig) => {
    setConfig(clone(cfg));
    setPreviewLayout(previewLayoutFromConfig(cfg, DEFAULT_PREVIEW_LAYOUT));
    setSelectedPresetId(undefined);
    setDirty(true);
  }, []);

  const openFlyout = useCallback((name: NajmComponentName) => {
    setSelectedComponent(name);
    setFlyoutOpen(true);
  }, []);
  const closeFlyout = useCallback(() => setFlyoutOpen(false), []);

  const saveTheme = useCallback(
    (name: string) => {
      const now = new Date().toISOString();
      setSaved((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, config: clone(config) },
      ]);
      setDirty(false);
    },
    [config],
  );

  const duplicateTheme = useCallback((id: string) => {
    setSaved((prev) => {
      const found = prev.find((s) => s.id === id);
      if (!found) return prev;
      const now = new Date().toISOString();
      return [
        ...prev,
        { ...clone(found), id: crypto.randomUUID(), name: `${found.name} copy`, createdAt: now, updatedAt: now },
      ];
    });
  }, []);

  const deleteTheme = useCallback((id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const loadSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const found = prev.find((s) => s.id === id);
      if (found) {
        setConfig(clone(found.config));
        setPreviewLayout(previewLayoutFromConfig(found.config, DEFAULT_PREVIEW_LAYOUT));
        setSelectedPresetId(undefined);
        setDirty(false);
      }
      return prev;
    });
  }, []);

  const value = useMemo<Store>(
    () => ({
      config,
      selectedPresetId,
      activeSettingsTab,
      activeTokenCategory,
      preview,
      previewLayout,
      selectedComponent,
      flyoutOpen,
      dirty,
      saved,
      setToken,
      resetToken,
      setThemeField,
      setMode,
      setAccent,
      setBorderWidth,
      setSpacing,
      setTypography,
      setComponentConfig,
      setComponentVariantAlias,
      resetComponent,
      loadPreset,
      importConfig,
      setTab: setActiveSettingsTab,
      setTokenCategory: setActiveTokenCategory,
      setPreview: setPreviewState,
      setPreviewGutter,
      setPreviewGap,
      resetPreviewLayout,
      selectComponent: setSelectedComponent,
      openFlyout,
      closeFlyout,
      saveTheme,
      duplicateTheme,
      deleteTheme,
      loadSaved,
    }),
    [
      config,
      selectedPresetId,
      activeSettingsTab,
      activeTokenCategory,
      preview,
      previewLayout,
      selectedComponent,
      flyoutOpen,
      dirty,
      saved,
      setToken,
      resetToken,
      setThemeField,
      setMode,
      setAccent,
      setBorderWidth,
      setSpacing,
      setTypography,
      setComponentConfig,
      setComponentVariantAlias,
      resetComponent,
      loadPreset,
      importConfig,
      setPreviewGutter,
      setPreviewGap,
      resetPreviewLayout,
      openFlyout,
      closeFlyout,
      saveTheme,
      duplicateTheme,
      deleteTheme,
      loadSaved,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): Store {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
