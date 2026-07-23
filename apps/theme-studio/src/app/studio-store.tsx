'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  composePreset,
  type NajmComponentName,
  type NajmComponentStyleConfig,
  type NajmDesignConfig,
  type NajmThemeTokens,
  type NajmTypographyConfig,
} from 'najm-kit';
import {
  DEFAULT_PRESET,
  PRESETS,
  presetConfigForMode,
  type StudioThemeMode,
} from '../theme/presets';
import { type TokenCategoryId, type TokenKey } from '../theme/token-meta';
import { themeStudioApi, type ThemeProject, type ThemeStyle } from './theme-studio-api';

export type SettingsTab =
  | 'colors'
  | 'typography'
  | 'layout'
  | 'components'
  | 'export';
export type PreviewId =
  | 'dashboard'
  | 'components'
  | 'forms'
  | 'data'
  | 'overlays'
  | 'charts';

export interface PreviewLayout {
  gutter: number;
  gap: number;
}

const DEFAULT_PREVIEW_LAYOUT: PreviewLayout = { gutter: 24, gap: 20 };
const PROJECT_DRAFT_PREFIX = 'najm-theme-studio/project-draft:';
const INTERNAL_AUTOSAVE_STYLE_NAME = 'Autosaved Style';

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
  projects: ThemeProject[];
  styles: ThemeStyle[];
  activeProject?: ThemeProject;
  activeProjectId?: string;
  activeStyleId?: string;
  loadingLibrary: boolean;
  libraryError?: string;
  notFound: boolean;
}

interface StudioActions {
  setToken: (key: TokenKey, value: string) => void;
  resetToken: (key: TokenKey) => void;
  setThemeField: <K extends keyof NajmDesignConfig['theme']>(
    key: K,
    value: NajmDesignConfig['theme'][K],
  ) => void;
  setMode: (mode: 'light' | 'dark') => void;
  setAccent: (accent: NajmDesignConfig['theme']['accent']) => void;
  setBorderWidth: (value: string) => void;
  setSpacing: (value: string) => void;
  setTypography: (patch: Partial<NajmTypographyConfig>) => void;
  setComponentConfig: (name: NajmComponentName, patch: Partial<NajmComponentStyleConfig>) => void;
  setComponentVariantAlias: (
    name: NajmComponentName,
    variant: string,
    use: string | undefined,
  ) => void;
  resetComponent: (name: NajmComponentName) => void;
  loadPreset: (id: string) => void;
  importConfig: (config: NajmDesignConfig) => Promise<ThemeStyle | undefined>;
  setTab: (tab: SettingsTab) => void;
  setTokenCategory: (cat: TokenCategoryId) => void;
  setPreview: (p: PreviewId) => void;
  setPreviewGutter: (value: number) => void;
  setPreviewGap: (value: number) => void;
  resetPreviewLayout: () => void;
  selectComponent: (name: NajmComponentName | undefined) => void;
  openFlyout: (name: NajmComponentName) => void;
  closeFlyout: () => void;
  loadProjects: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createProject: (input: { name: string; slug?: string; description?: string }) => Promise<ThemeProject | undefined>;
  deleteProject: (projectId: string) => Promise<void>;
  loadStyle: (styleId: string) => Promise<void>;
  saveProjectDraft: () => Date | undefined;
  saveCurrentStyle: () => Promise<ThemeStyle | undefined>;
  saveThemeAs: (name: string) => Promise<ThemeStyle | undefined>;
  duplicateStyle: (styleId: string) => Promise<ThemeStyle | undefined>;
  deleteStyle: (styleId: string) => Promise<void>;
  setDefaultStyle: (styleId: string) => Promise<void>;
}

type Store = StudioState & StudioActions;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function modeOf(config: NajmDesignConfig): StudioThemeMode {
  return config.theme.mode === 'dark' ? 'dark' : 'light';
}

type ThemeConfig = NajmDesignConfig['theme'];

function themeMode(mode: ThemeConfig['mode']): StudioThemeMode {
  return mode === 'dark' ? 'dark' : 'light';
}

/**
 * Active token set for a mode: the composed preset merged with the user's
 * per-mode overrides. Overrides win, so hand-edited tokens survive mode/accent
 * changes while everything else follows the preset.
 */
function composeTokens(
  mode: StudioThemeMode,
  accent: ThemeConfig['accent'],
  overrides: ThemeConfig['overrides'],
): NajmThemeTokens {
  const base = composePreset(mode, accent ?? 'neutral');
  const modeOverrides = overrides?.[mode];
  return (modeOverrides ? { ...base, ...modeOverrides } : base) as NajmThemeTokens;
}

/**
 * Records any token in the active set that deviates from the base palette as a
 * per-mode override. This normalizes incoming configs (styles, presets, imports)
 * — including presets that bake colors straight into `tokens` — so every
 * customization is mode-scoped and survives switching modes. Existing explicit
 * overrides take precedence over derived ones.
 */
function withSeededOverrides(config: NajmDesignConfig): NajmDesignConfig {
  const theme = config.theme;
  const tokens = theme.tokens as Record<string, string> | undefined;
  const mode = themeMode(theme.mode);
  const base = composePreset(mode, theme.accent ?? 'neutral') as Record<string, string>;
  const derived: Record<string, string> = {};
  if (tokens) {
    for (const [key, value] of Object.entries(tokens)) {
      if (value != null && base[key] !== value) derived[key] = value;
    }
  }
  const merged = { ...derived, ...(theme.overrides?.[mode] ?? {}) };
  const overrides = Object.keys(merged).length
    ? { ...(theme.overrides ?? {}), [mode]: merged as NajmThemeTokens }
    : theme.overrides;

  return {
    ...config,
    theme: {
      ...theme,
      overrides,
      tokens: composeTokens(mode, theme.accent, overrides),
    },
  };
}

function previewLayoutFromConfig(
  config: NajmDesignConfig,
  fallback: PreviewLayout,
): PreviewLayout {
  return {
    gutter: clampSpace(parseFloat(config.layout?.pageGutter ?? ''), fallback.gutter),
    gap: clampSpace(parseFloat(config.layout?.sectionGap ?? ''), fallback.gap),
  };
}

function clampSpace(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(64, Math.round(n)));
}

function projectDraftKey(projectId: string): string {
  return `${PROJECT_DRAFT_PREFIX}${projectId}`;
}

function readProjectDraft(projectId: string): NajmDesignConfig | undefined {
  try {
    const raw = localStorage.getItem(projectDraftKey(projectId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { config?: NajmDesignConfig };
    return parsed.config ? clone(parsed.config) : undefined;
  } catch {
    return undefined;
  }
}

function writeProjectDraft(projectId: string, config: NajmDesignConfig): Date | undefined {
  try {
    const savedAt = new Date();
    localStorage.setItem(
      projectDraftKey(projectId),
      JSON.stringify({ savedAt: savedAt.toISOString(), config }),
    );
    return savedAt;
  } catch {
    return undefined;
  }
}

function deleteProjectDraft(projectId: string) {
  try {
    localStorage.removeItem(projectDraftKey(projectId));
  } catch {
    /* ignore */
  }
}

const StudioContext = createContext<Store | null>(null);

export function StudioProvider({
  initialProjectId,
  children,
}: {
  initialProjectId?: string;
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<NajmDesignConfig>(() => clone(DEFAULT_PRESET.config));
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(DEFAULT_PRESET.id);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('colors');
  const [activeTokenCategory, setActiveTokenCategory] = useState<TokenCategoryId>('foundation');
  const [preview, setPreviewState] = useState<PreviewId>('dashboard');
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>(DEFAULT_PREVIEW_LAYOUT);
  const [selectedComponent, setSelectedComponent] = useState<NajmComponentName | undefined>();
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRevisionRef = useRef(0);

  const [projects, setProjects] = useState<ThemeProject[]>([]);
  const [styles, setStyles] = useState<ThemeStyle[]>([]);
  const [activeProject, setActiveProject] = useState<ThemeProject | undefined>();
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>();
  const [activeStyleId, setActiveStyleId] = useState<string | undefined>();
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | undefined>();
  const [notFound, setNotFound] = useState(false);

  const markDirty = useCallback(() => {
    dirtyRevisionRef.current += 1;
    setDirty(true);
  }, []);

  const markClean = useCallback(() => {
    setDirty(false);
  }, []);

  const markCleanIfUnchanged = useCallback((revision: number) => {
    if (dirtyRevisionRef.current === revision) {
      setDirty(false);
    }
  }, []);

  const applyConfig = useCallback((next: NajmDesignConfig, shouldMarkDirty: boolean) => {
    const seeded = withSeededOverrides(next);
    setConfig(seeded);
    setPreviewLayout(previewLayoutFromConfig(seeded, DEFAULT_PREVIEW_LAYOUT));
    if (shouldMarkDirty) markDirty();
    return seeded;
  }, [markDirty]);

  const applyStyle = useCallback(
    (style: ThemeStyle) => {
      applyConfig(clone(style.config), false);
      setActiveStyleId(style.id);
      setActiveProjectId(style.projectId);
      markClean();
    },
    [applyConfig, markClean],
  );

  const selectProject = useCallback(async (projectId: string) => {
    setActiveProjectId(projectId);
    setLibraryError(undefined);
    try {
      const nextStyles = await themeStudioApi.listStyles(projectId);
      const internalDraftStyle = nextStyles.find((s) => s.name === INTERNAL_AUTOSAVE_STYLE_NAME);
      const visibleStyles = nextStyles.filter((s) => s.name !== INTERNAL_AUTOSAVE_STYLE_NAME);
      setStyles(visibleStyles);
      const def = visibleStyles.find((s) => s.isDefault) ?? visibleStyles[0];
      if (def) {
        applyStyle(def);
      } else {
        const draft = readProjectDraft(projectId) ?? internalDraftStyle?.config;
        if (draft) {
          applyConfig(draft, false);
          markClean();
        }
        setActiveStyleId(undefined);
      }
    } catch (error) {
      setLibraryError((error as Error).message);
    }
  }, [applyConfig, applyStyle, markClean]);

  const loadProjects = useCallback(async () => {
    setLoadingLibrary(true);
    setLibraryError(undefined);
    try {
      const nextProjects = await themeStudioApi.listProjects();
      setProjects(nextProjects);
    } catch (error) {
      setLibraryError((error as Error).message);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  const loadProject = useCallback(
    async (projectId: string) => {
      setLoadingLibrary(true);
      setLibraryError(undefined);
      setNotFound(false);
      try {
        const project = await themeStudioApi.getProject(projectId);
        setActiveProject(project);
        setProjects([project]);
        await selectProject(projectId);
      } catch (error) {
        setNotFound(true);
        setActiveProject(undefined);
        setProjects([]);
        setStyles([]);
        setActiveProjectId(undefined);
        setActiveStyleId(undefined);
        setLibraryError((error as Error).message);
      } finally {
        setLoadingLibrary(false);
      }
    },
    [selectProject],
  );

  useEffect(() => {
    if (initialProjectId) void loadProject(initialProjectId);
  }, [initialProjectId, loadProject]);

  const createProject = useCallback(
    async (input: { name: string; slug?: string; description?: string }) => {
      try {
        setLibraryError(undefined);
        const project = await themeStudioApi.createProject(input);
        setProjects((prev) => [...prev, project]);
        setActiveProject(project);
        await selectProject(project.id);
        return project;
      } catch (error) {
        setLibraryError((error as Error).message);
        return undefined;
      }
    },
    [selectProject],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        await themeStudioApi.deleteProject(projectId);
        const remaining = projects.filter((project) => project.id !== projectId);
        setProjects(remaining);
        if (activeProjectId === projectId) {
          setStyles([]);
          setActiveProject(undefined);
          setActiveProjectId(undefined);
          setActiveStyleId(undefined);
        }
      } catch (error) {
        setLibraryError((error as Error).message);
      }
    },
    [projects, activeProjectId],
  );

  const loadStyle = useCallback(
    async (styleId: string) => {
      try {
        const style = await themeStudioApi.getStyle(styleId);
        applyStyle(style);
        setStyles((prev) => {
          const idx = prev.findIndex((s) => s.id === style.id);
          if (idx === -1) return [...prev, style];
          const next = [...prev];
          next[idx] = style;
          return next;
        });
      } catch (error) {
        setLibraryError((error as Error).message);
      }
    },
    [applyStyle],
  );

  const saveCurrentStyle = useCallback(async () => {
    if (!activeStyleId) return undefined;
    const saveRevision = dirtyRevisionRef.current;
    try {
      const saved = await themeStudioApi.updateStyle(activeStyleId, { config });
      setStyles((prev) => prev.map((style) => (style.id === saved.id ? saved : style)));
      markCleanIfUnchanged(saveRevision);
      return saved;
    } catch (error) {
      setLibraryError((error as Error).message);
      return undefined;
    }
  }, [activeStyleId, config, markCleanIfUnchanged]);

  const saveProjectDraft = useCallback(() => {
    if (!activeProjectId) return undefined;
    const saveRevision = dirtyRevisionRef.current;
    const savedAt = writeProjectDraft(activeProjectId, config);
    if (savedAt) markCleanIfUnchanged(saveRevision);
    return savedAt;
  }, [activeProjectId, config, markCleanIfUnchanged]);

  const saveThemeAs = useCallback(
    async (name: string) => {
      if (!activeProjectId) return undefined;
      const saveRevision = dirtyRevisionRef.current;
      try {
        const saved = await themeStudioApi.createStyle(activeProjectId, {
          name,
          config,
        });
        setStyles((prev) => [
          ...prev.filter((style) => style.name !== INTERNAL_AUTOSAVE_STYLE_NAME),
          saved,
        ]);
        setActiveStyleId(saved.id);
        deleteProjectDraft(activeProjectId);
        markCleanIfUnchanged(saveRevision);
        return saved;
      } catch (error) {
        setLibraryError((error as Error).message);
        return undefined;
      }
    },
    [activeProjectId, config, markCleanIfUnchanged],
  );

  const duplicateStyle = useCallback(
    async (styleId: string) => {
      try {
        const saved = await themeStudioApi.duplicateStyle(styleId);
        setStyles((prev) => [...prev, saved]);
        if (saved.projectId === activeProjectId) {
          setActiveStyleId(saved.id);
          applyConfig(clone(saved.config), false);
          markClean();
        }
        return saved;
      } catch (error) {
        setLibraryError((error as Error).message);
        return undefined;
      }
    },
    [activeProjectId, applyConfig, markClean],
  );

  const deleteStyle = useCallback(
    async (styleId: string) => {
      try {
        await themeStudioApi.deleteStyle(styleId);
        const remaining = styles.filter((style) => style.id !== styleId);
        setStyles(remaining);
        if (activeStyleId === styleId) {
          const fallback = remaining[0];
          if (fallback) {
            await loadStyle(fallback.id);
          } else {
            setActiveStyleId(undefined);
          }
        }
      } catch (error) {
        setLibraryError((error as Error).message);
      }
    },
    [styles, activeStyleId, loadStyle],
  );

  const setDefaultStyle = useCallback(
    async (styleId: string) => {
      try {
        const saved = await themeStudioApi.setDefaultStyle(styleId);
        setStyles((prev) =>
          prev.map((style) => ({
            ...style,
            isDefault: style.id === saved.id,
          })),
        );
      } catch (error) {
        setLibraryError((error as Error).message);
      }
    },
    [],
  );

  const mutateTheme = useCallback((fn: (t: NajmDesignConfig['theme']) => void) => {
    setConfig((prev) => {
      const next = clone(prev);
      fn(next.theme);
      return next;
    });
    markDirty();
  }, [markDirty]);

  const setToken = useCallback(
    (key: TokenKey, value: string) => {
      mutateTheme((theme) => {
        const mode = themeMode(theme.mode);
        // Record the edit in this mode's override bucket so it stays
        // independent from the other mode.
        const overrides = { ...(theme.overrides ?? {}) };
        overrides[mode] = { ...(overrides[mode] ?? {}), [key]: value };
        theme.overrides = overrides;
        // Mirror into the active token set the provider renders from.
        theme.tokens = { ...(theme.tokens ?? {}) } as NajmThemeTokens;
        (theme.tokens as Record<string, string>)[key] = value;
      });
    },
    [mutateTheme],
  );

  const resetToken = useCallback(
    (key: TokenKey) => {
      mutateTheme((theme) => {
        const mode = themeMode(theme.mode);
        // Drop the override for this mode (leaving the other mode untouched).
        const modeOverrides = { ...(theme.overrides?.[mode] ?? {}) } as Record<string, string>;
        delete modeOverrides[key];
        const overrides = { ...(theme.overrides ?? {}) };
        if (Object.keys(modeOverrides).length) overrides[mode] = modeOverrides as NajmThemeTokens;
        else delete overrides[mode];
        theme.overrides = overrides;
        // Restore the preset's base value for this token.
        const base = composePreset(mode, theme.accent ?? 'neutral') as Record<string, string>;
        theme.tokens = { ...(theme.tokens ?? {}) } as NajmThemeTokens;
        if (base[key] !== undefined) (theme.tokens as Record<string, string>)[key] = base[key];
        else delete (theme.tokens as Record<string, string>)[key];
      });
    },
    [mutateTheme],
  );

  const setThemeField = useCallback(
    <K extends keyof NajmDesignConfig['theme']>(
      key: K,
      value: NajmDesignConfig['theme'][K],
    ) => {
      mutateTheme((theme) => {
        theme[key] = value;
      });
    },
    [mutateTheme],
  );

  const setMode = useCallback(
    (mode: 'light' | 'dark') => {
      if (modeOf(config) === mode) return;
      const next = clone(config);
      next.theme = {
        ...next.theme,
        mode,
        tokens: composeTokens(mode, next.theme.accent, next.theme.overrides),
      };
      applyConfig(next, true);
    },
    [config, applyConfig],
  );

  const setAccent = useCallback(
    (accent: NajmDesignConfig['theme']['accent']) => {
      mutateTheme((theme) => {
        theme.accent = accent;
        theme.tokens = composeTokens(themeMode(theme.mode), accent, theme.overrides);
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
    markDirty();
  }, [markDirty]);

  const setPreviewGap = useCallback((value: number) => {
    const gap = clampSpace(value, DEFAULT_PREVIEW_LAYOUT.gap);
    setPreviewLayout((prev) => ({ ...prev, gap }));
    setConfig((prev) => ({
      ...prev,
      layout: { ...(prev.layout ?? {}), sectionGap: `${gap}px` },
    }));
    markDirty();
  }, [markDirty]);

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
    markDirty();
  }, [markDirty]);

  const setTypography = useCallback((patch: Partial<NajmTypographyConfig>) => {
    setConfig((prev) => {
      const next = clone(prev);
      next.typography = { ...(next.typography ?? {}), ...patch };
      return next;
    });
    markDirty();
  }, [markDirty]);

  const setComponentConfig = useCallback(
    (name: NajmComponentName, patch: Partial<NajmComponentStyleConfig>) => {
      setConfig((prev) => {
        const next = clone(prev);
        next.components = { ...(next.components ?? {}) };
        const component = { ...(next.components[name] ?? {}) } as Record<string, unknown>;
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined || value === '') {
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
      markDirty();
    },
    [markDirty],
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
      markDirty();
    },
    [markDirty],
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
    markDirty();
  }, [markDirty]);

  const loadPreset = useCallback(
    (id: string) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return;
      const next = clone(presetConfigForMode(preset, modeOf(config)));
      applyConfig(next, false);
      setSelectedPresetId(id);
      markClean();
    },
    [config, applyConfig, markClean],
  );

  const importConfig = useCallback(
    async (cfg: NajmDesignConfig) => {
      const imported = applyConfig(clone(cfg), true);
      const saveRevision = dirtyRevisionRef.current;
      setSelectedPresetId(undefined);
      if (!activeProjectId) return undefined;
      try {
        const saved = await themeStudioApi.createStyle(activeProjectId, {
          name: `${(activeStyleId ? 'Imported' : 'Imported')} ${new Date().toISOString().slice(0, 10)}`,
          config: imported,
          isDefault: true,
        });
        setStyles((prev) => [
          ...prev.map((style) => ({ ...style, isDefault: false })),
          saved,
        ]);
        setActiveStyleId(saved.id);
        markCleanIfUnchanged(saveRevision);
        return saved;
      } catch (error) {
        setLibraryError((error as Error).message);
        return undefined;
      }
    },
    [activeProjectId, activeStyleId, applyConfig, markCleanIfUnchanged],
  );

  const openFlyout = useCallback((name: NajmComponentName) => {
    setSelectedComponent(name);
    setFlyoutOpen(true);
  }, []);
  const closeFlyout = useCallback(() => setFlyoutOpen(false), []);
  const selectComponent = useCallback((name: NajmComponentName | undefined) => {
    setSelectedComponent(name);
    if (name === 'sidebar') {
      setActiveSettingsTab('colors');
      setActiveTokenCategory('sidebar');
    } else if (name === 'table') {
      setActiveSettingsTab('colors');
      setActiveTokenCategory('table');
    }
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
      projects,
      styles,
      activeProject,
      activeProjectId,
      activeStyleId,
      loadingLibrary,
      libraryError,
      notFound,
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
      selectComponent,
      openFlyout,
      closeFlyout,
      loadProjects,
      selectProject,
      createProject,
      deleteProject,
      loadStyle,
      saveProjectDraft,
      saveCurrentStyle,
      saveThemeAs,
      duplicateStyle,
      deleteStyle,
      setDefaultStyle,
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
      projects,
      styles,
      activeProject,
      activeProjectId,
      activeStyleId,
      loadingLibrary,
      libraryError,
      notFound,
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
      selectComponent,
      openFlyout,
      closeFlyout,
      loadProjects,
      selectProject,
      createProject,
      deleteProject,
      loadStyle,
      saveProjectDraft,
      saveCurrentStyle,
      saveThemeAs,
      duplicateStyle,
      deleteStyle,
      setDefaultStyle,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): Store {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}
