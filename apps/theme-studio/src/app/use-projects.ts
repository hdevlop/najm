'use client';

import { useCallback, useEffect, useState } from 'react';
import { composePreset, type NajmAccent, type NajmDesignConfig } from 'najm-kit';
import { themeStudioApi, type ThemeProject, type ThemeStyle } from './theme-studio-api';
import { DEFAULT_PRESET, PRESETS, presetConfigForMode, type StudioThemeMode } from '../theme/presets';

export const INITIAL_THEME_ACCENTS = ['neutral', 'emerald', 'green', 'slate', 'blue', 'violet'] as const satisfies readonly NajmAccent[];

export interface CreateProjectInput {
  name: string;
  slug?: string;
  description?: string;
  presetId?: string;
  accent?: NajmAccent;
}

export interface ProjectCardData extends ThemeProject {
  styleCount: number;
  defaultStyle?: ThemeStyle;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function modeOf(config: NajmDesignConfig): StudioThemeMode {
  return config.theme.mode === 'dark' ? 'dark' : 'light';
}

function initialDesignConfig(input: CreateProjectInput): NajmDesignConfig {
  const preset = PRESETS.find((p) => p.id === input.presetId) ?? DEFAULT_PRESET;
  const mode = modeOf(preset.config);
  const config = clone(presetConfigForMode(preset, mode));
  const presetAccent = config.theme.accent ?? 'neutral';
  const accent = input.accent ?? presetAccent;

  return {
    ...config,
    theme: {
      ...config.theme,
      accent,
      tokens: accent === presetAccent ? config.theme.tokens : composePreset(mode, accent),
    },
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const list = await themeStudioApi.listProjects();
      const enriched = await Promise.all(
        list.map(async (project) => {
          const styles = await themeStudioApi.listStyles(project.id);
          const visibleStyles = styles.filter((style) => style.name !== 'Autosaved Style');
          return {
            ...project,
            styleCount: visibleStyles.length,
            defaultStyle: visibleStyles.find((style) => style.isDefault) ?? visibleStyles[0],
          };
        }),
      );
      enriched.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
      setProjects(enriched);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      const project = await themeStudioApi.createProject({
        name: input.name,
        slug: input.slug,
        description: input.description,
      });
      await themeStudioApi.createStyle(project.id, {
        name: 'Default Style',
        config: initialDesignConfig(input),
        isDefault: true,
      });
      await refresh();
      return project;
    },
    [refresh],
  );

  const deleteProject = useCallback(async (id: string) => {
    await themeStudioApi.deleteProject(id);
    setProjects((prev) => prev.filter((project) => project.id !== id));
  }, []);

  return { projects, loading, error, refresh, createProject, deleteProject };
}
