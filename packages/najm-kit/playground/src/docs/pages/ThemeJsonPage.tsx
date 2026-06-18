import React, { useMemo, useState } from 'react';
import {
  Badge,
  composePreset,
  NButton,
  NCard,
  NSheet,
  NajmThemeProvider,
  SelectInput,
  stringifyNajmThemeConfig,
  TextInput,
  type NajmAccent,
  type NajmMode,
  type NajmThemeConfig,
  type NajmThemeTokens,
} from 'najm-kit';
import {
  Activity,
  BarChart3,
  Bell,
  CreditCard,
  LayoutDashboard,
  Package,
  Palette,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { CodeBlock } from '../CodeBlock';

const violetTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'violet',
  radius: '0.85rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    background: 'oklch(0.145 0.024 285.7)',
    foreground: 'oklch(0.968 0.001 286.375)',
    card: 'oklch(0.21 0.034 285.3)',
    'card-foreground': 'oklch(0.968 0.001 286.375)',
    popover: 'oklch(0.21 0.034 285.3)',
    'popover-foreground': 'oklch(0.968 0.001 286.375)',
    primary: 'oklch(0.62 0.24 292)',
    'primary-foreground': 'oklch(1 0 0)',
    secondary: 'oklch(0.274 0.024 285.5)',
    'secondary-foreground': 'oklch(0.92 0.003 286.332)',
    tertiary: 'oklch(0.32 0.04 285.8)',
    'tertiary-foreground': 'oklch(0.90 0.003 286.332)',
    muted: 'oklch(0.274 0.024 285.5)',
    'muted-foreground': 'oklch(0.72 0.017 285.896)',
    accent: 'oklch(0.30 0.12 294)',
    'accent-foreground': 'oklch(0.90 0.05 301)',
    destructive: 'oklch(0.64 0.19 25)',
    'destructive-foreground': 'oklch(0.98 0.01 25)',
    border: 'oklch(0.34 0.034 285.8)',
    input: 'oklch(0.34 0.034 285.8)',
    ring: 'oklch(0.72 0.22 292)',
    sidebar: 'oklch(0.18 0.03 286)',
    'sidebar-foreground': 'oklch(0.94 0.01 286)',
    'sidebar-primary': 'oklch(0.62 0.24 292)',
    'sidebar-primary-foreground': 'oklch(1 0 0)',
    'sidebar-accent': 'oklch(0.25 0.08 292)',
    'sidebar-accent-foreground': 'oklch(0.92 0.04 301)',
    'sidebar-border': 'oklch(0.32 0.035 286)',
    'sidebar-ring': 'oklch(0.72 0.22 292)',
    'chart-1': 'oklch(0.70 0.22 292)',
    'chart-2': 'oklch(0.68 0.17 245)',
    'chart-3': 'oklch(0.76 0.18 155)',
    'chart-4': 'oklch(0.74 0.18 65)',
    'chart-5': 'oklch(0.69 0.19 28)',
  },
};

const emeraldTheme: NajmThemeConfig = {
  ...violetTheme,
  accent: 'emerald',
  radius: '0.5rem',
  tokens: {
    ...violetTheme.tokens,
    primary: 'oklch(0.70 0.16 162)',
    ring: 'oklch(0.75 0.18 162)',
    accent: 'oklch(0.31 0.10 164)',
    'accent-foreground': 'oklch(0.92 0.09 171)',
    'sidebar-primary': 'oklch(0.70 0.16 162)',
    'sidebar-accent': 'oklch(0.29 0.09 164)',
    'sidebar-accent-foreground': 'oklch(0.92 0.09 171)',
    'chart-1': 'oklch(0.70 0.16 162)',
    'chart-2': 'oklch(0.74 0.18 142)',
    'chart-3': 'oklch(0.76 0.15 190)',
  },
};

const lightTheme: NajmThemeConfig = {
  mode: 'light',
  accent: 'blue',
  radius: '1.1rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    background: 'oklch(0.985 0.006 250)',
    foreground: 'oklch(0.18 0.025 255)',
    card: 'oklch(1 0 0)',
    'card-foreground': 'oklch(0.18 0.025 255)',
    popover: 'oklch(1 0 0)',
    'popover-foreground': 'oklch(0.18 0.025 255)',
    primary: 'oklch(0.58 0.20 255)',
    'primary-foreground': 'oklch(1 0 0)',
    secondary: 'oklch(0.94 0.018 255)',
    'secondary-foreground': 'oklch(0.24 0.03 255)',
    tertiary: 'oklch(0.90 0.025 255)',
    'tertiary-foreground': 'oklch(0.28 0.04 255)',
    muted: 'oklch(0.94 0.018 255)',
    'muted-foreground': 'oklch(0.48 0.035 255)',
    accent: 'oklch(0.92 0.055 255)',
    'accent-foreground': 'oklch(0.30 0.12 255)',
    destructive: 'oklch(0.62 0.20 25)',
    'destructive-foreground': 'oklch(1 0 0)',
    border: 'oklch(0.86 0.025 255)',
    input: 'oklch(0.86 0.025 255)',
    ring: 'oklch(0.58 0.20 255)',
    sidebar: 'oklch(0.96 0.018 255)',
    'sidebar-foreground': 'oklch(0.22 0.03 255)',
    'sidebar-primary': 'oklch(0.58 0.20 255)',
    'sidebar-primary-foreground': 'oklch(1 0 0)',
    'sidebar-accent': 'oklch(0.90 0.045 255)',
    'sidebar-accent-foreground': 'oklch(0.30 0.12 255)',
    'sidebar-border': 'oklch(0.84 0.025 255)',
    'sidebar-ring': 'oklch(0.58 0.20 255)',
    'chart-1': 'oklch(0.58 0.20 255)',
    'chart-2': 'oklch(0.70 0.18 165)',
    'chart-3': 'oklch(0.72 0.20 75)',
    'chart-4': 'oklch(0.66 0.18 315)',
    'chart-5': 'oklch(0.68 0.19 25)',
  },
};

const slateTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'slate',
  radius: '0.5rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    background: 'oklch(0.13 0.018 260)',
    foreground: 'oklch(0.96 0.004 260)',
    card: 'oklch(0.18 0.022 260)',
    'card-foreground': 'oklch(0.96 0.004 260)',
    popover: 'oklch(0.18 0.022 260)',
    'popover-foreground': 'oklch(0.96 0.004 260)',
    primary: 'oklch(0.72 0.13 165)',
    'primary-foreground': 'oklch(0.12 0.018 260)',
    secondary: 'oklch(0.24 0.025 260)',
    'secondary-foreground': 'oklch(0.92 0.006 260)',
    tertiary: 'oklch(0.28 0.026 260)',
    'tertiary-foreground': 'oklch(0.88 0.008 260)',
    muted: 'oklch(0.24 0.025 260)',
    'muted-foreground': 'oklch(0.70 0.025 260)',
    accent: 'oklch(0.29 0.07 165)',
    'accent-foreground': 'oklch(0.90 0.08 165)',
    destructive: 'oklch(0.62 0.19 28)',
    'destructive-foreground': 'oklch(0.98 0.01 28)',
    border: 'oklch(0.33 0.035 260)',
    input: 'oklch(0.33 0.035 260)',
    ring: 'oklch(0.72 0.13 165)',
    sidebar: 'oklch(0.16 0.02 260)',
    'sidebar-foreground': 'oklch(0.93 0.006 260)',
    'sidebar-primary': 'oklch(0.72 0.13 165)',
    'sidebar-primary-foreground': 'oklch(0.12 0.018 260)',
    'sidebar-accent': 'oklch(0.25 0.055 165)',
    'sidebar-accent-foreground': 'oklch(0.90 0.08 165)',
    'sidebar-border': 'oklch(0.31 0.035 260)',
    'sidebar-ring': 'oklch(0.72 0.13 165)',
    'chart-1': 'oklch(0.72 0.13 165)',
    'chart-2': 'oklch(0.70 0.15 245)',
    'chart-3': 'oklch(0.76 0.16 75)',
    'chart-4': 'oklch(0.68 0.16 315)',
    'chart-5': 'oklch(0.72 0.18 25)',
  },
};

// ── World-class presets (popular design systems & editor themes) ──

const tokyoNightTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'blue',
  radius: '0.6rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    ...violetTheme.tokens,
    background: 'oklch(0.21 0.02 270)',
    foreground: 'oklch(0.83 0.05 275)',
    card: 'oklch(0.25 0.025 270)',
    'card-foreground': 'oklch(0.83 0.05 275)',
    popover: 'oklch(0.25 0.025 270)',
    'popover-foreground': 'oklch(0.83 0.05 275)',
    primary: 'oklch(0.70 0.13 262)',
    'primary-foreground': 'oklch(0.18 0.02 270)',
    secondary: 'oklch(0.30 0.025 268)',
    'secondary-foreground': 'oklch(0.82 0.04 275)',
    tertiary: 'oklch(0.34 0.03 268)',
    'tertiary-foreground': 'oklch(0.80 0.04 275)',
    muted: 'oklch(0.28 0.025 268)',
    'muted-foreground': 'oklch(0.66 0.04 272)',
    accent: 'oklch(0.75 0.13 300)',
    'accent-foreground': 'oklch(0.20 0.03 300)',
    destructive: 'oklch(0.66 0.18 18)',
    'destructive-foreground': 'oklch(0.98 0.01 18)',
    border: 'oklch(0.33 0.025 268)',
    input: 'oklch(0.33 0.025 268)',
    ring: 'oklch(0.70 0.13 262)',
    sidebar: 'oklch(0.18 0.02 270)',
    'sidebar-foreground': 'oklch(0.80 0.04 275)',
    'sidebar-primary': 'oklch(0.70 0.13 262)',
    'sidebar-primary-foreground': 'oklch(0.18 0.02 270)',
    'sidebar-accent': 'oklch(0.34 0.08 280)',
    'sidebar-accent-foreground': 'oklch(0.85 0.06 290)',
    'sidebar-border': 'oklch(0.28 0.025 270)',
    'sidebar-ring': 'oklch(0.70 0.13 262)',
    'chart-1': 'oklch(0.70 0.13 262)',
    'chart-2': 'oklch(0.75 0.13 300)',
    'chart-3': 'oklch(0.80 0.12 190)',
    'chart-4': 'oklch(0.78 0.13 150)',
    'chart-5': 'oklch(0.80 0.13 75)',
  },
};

const draculaTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'violet',
  radius: '0.5rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    ...violetTheme.tokens,
    background: 'oklch(0.28 0.03 286)',
    foreground: 'oklch(0.96 0.01 95)',
    card: 'oklch(0.32 0.028 286)',
    'card-foreground': 'oklch(0.96 0.01 95)',
    popover: 'oklch(0.32 0.028 286)',
    'popover-foreground': 'oklch(0.96 0.01 95)',
    primary: 'oklch(0.74 0.15 300)',
    'primary-foreground': 'oklch(0.18 0.03 286)',
    secondary: 'oklch(0.38 0.03 286)',
    'secondary-foreground': 'oklch(0.95 0.01 95)',
    tertiary: 'oklch(0.42 0.03 286)',
    'tertiary-foreground': 'oklch(0.93 0.01 95)',
    muted: 'oklch(0.36 0.028 286)',
    'muted-foreground': 'oklch(0.74 0.03 286)',
    accent: 'oklch(0.74 0.18 350)',
    'accent-foreground': 'oklch(0.20 0.03 350)',
    destructive: 'oklch(0.66 0.20 25)',
    'destructive-foreground': 'oklch(0.98 0.01 25)',
    border: 'oklch(0.42 0.03 286)',
    input: 'oklch(0.42 0.03 286)',
    ring: 'oklch(0.74 0.15 300)',
    sidebar: 'oklch(0.24 0.028 286)',
    'sidebar-foreground': 'oklch(0.94 0.01 95)',
    'sidebar-primary': 'oklch(0.74 0.15 300)',
    'sidebar-primary-foreground': 'oklch(0.18 0.03 286)',
    'sidebar-accent': 'oklch(0.36 0.08 320)',
    'sidebar-accent-foreground': 'oklch(0.92 0.06 340)',
    'sidebar-border': 'oklch(0.38 0.03 286)',
    'sidebar-ring': 'oklch(0.74 0.15 300)',
    'chart-1': 'oklch(0.74 0.15 300)',
    'chart-2': 'oklch(0.74 0.18 350)',
    'chart-3': 'oklch(0.86 0.20 145)',
    'chart-4': 'oklch(0.85 0.13 200)',
    'chart-5': 'oklch(0.85 0.16 95)',
  },
};

const nordTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'blue',
  radius: '0.5rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    ...violetTheme.tokens,
    background: 'oklch(0.32 0.02 264)',
    foreground: 'oklch(0.92 0.01 255)',
    card: 'oklch(0.36 0.02 262)',
    'card-foreground': 'oklch(0.92 0.01 255)',
    popover: 'oklch(0.36 0.02 262)',
    'popover-foreground': 'oklch(0.92 0.01 255)',
    primary: 'oklch(0.79 0.07 220)',
    'primary-foreground': 'oklch(0.26 0.02 264)',
    secondary: 'oklch(0.42 0.02 260)',
    'secondary-foreground': 'oklch(0.90 0.01 255)',
    tertiary: 'oklch(0.46 0.02 260)',
    'tertiary-foreground': 'oklch(0.88 0.01 255)',
    muted: 'oklch(0.40 0.02 260)',
    'muted-foreground': 'oklch(0.78 0.015 255)',
    accent: 'oklch(0.60 0.08 250)',
    'accent-foreground': 'oklch(0.93 0.02 250)',
    destructive: 'oklch(0.64 0.16 25)',
    'destructive-foreground': 'oklch(0.97 0.01 25)',
    border: 'oklch(0.45 0.02 260)',
    input: 'oklch(0.45 0.02 260)',
    ring: 'oklch(0.79 0.07 220)',
    sidebar: 'oklch(0.29 0.02 264)',
    'sidebar-foreground': 'oklch(0.90 0.01 255)',
    'sidebar-primary': 'oklch(0.79 0.07 220)',
    'sidebar-primary-foreground': 'oklch(0.26 0.02 264)',
    'sidebar-accent': 'oklch(0.45 0.06 250)',
    'sidebar-accent-foreground': 'oklch(0.92 0.02 250)',
    'sidebar-border': 'oklch(0.40 0.02 262)',
    'sidebar-ring': 'oklch(0.79 0.07 220)',
    'chart-1': 'oklch(0.79 0.07 220)',
    'chart-2': 'oklch(0.60 0.08 250)',
    'chart-3': 'oklch(0.76 0.09 150)',
    'chart-4': 'oklch(0.85 0.10 90)',
    'chart-5': 'oklch(0.72 0.10 20)',
  },
};

const catppuccinTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'violet',
  radius: '0.85rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    ...violetTheme.tokens,
    background: 'oklch(0.24 0.02 285)',
    foreground: 'oklch(0.87 0.04 280)',
    card: 'oklch(0.28 0.02 285)',
    'card-foreground': 'oklch(0.87 0.04 280)',
    popover: 'oklch(0.28 0.02 285)',
    'popover-foreground': 'oklch(0.87 0.04 280)',
    primary: 'oklch(0.77 0.10 305)',
    'primary-foreground': 'oklch(0.20 0.02 285)',
    secondary: 'oklch(0.33 0.02 285)',
    'secondary-foreground': 'oklch(0.86 0.03 280)',
    tertiary: 'oklch(0.37 0.02 285)',
    'tertiary-foreground': 'oklch(0.84 0.03 280)',
    muted: 'oklch(0.31 0.02 285)',
    'muted-foreground': 'oklch(0.72 0.03 280)',
    accent: 'oklch(0.85 0.08 350)',
    'accent-foreground': 'oklch(0.25 0.03 350)',
    destructive: 'oklch(0.70 0.13 15)',
    'destructive-foreground': 'oklch(0.98 0.01 15)',
    border: 'oklch(0.37 0.02 285)',
    input: 'oklch(0.37 0.02 285)',
    ring: 'oklch(0.77 0.10 305)',
    sidebar: 'oklch(0.21 0.02 285)',
    'sidebar-foreground': 'oklch(0.85 0.03 280)',
    'sidebar-primary': 'oklch(0.77 0.10 305)',
    'sidebar-primary-foreground': 'oklch(0.20 0.02 285)',
    'sidebar-accent': 'oklch(0.34 0.07 320)',
    'sidebar-accent-foreground': 'oklch(0.88 0.06 340)',
    'sidebar-border': 'oklch(0.30 0.02 285)',
    'sidebar-ring': 'oklch(0.77 0.10 305)',
    'chart-1': 'oklch(0.77 0.10 305)',
    'chart-2': 'oklch(0.85 0.08 350)',
    'chart-3': 'oklch(0.84 0.11 150)',
    'chart-4': 'oklch(0.83 0.09 220)',
    'chart-5': 'oklch(0.84 0.10 75)',
  },
};

const githubDarkTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'blue',
  radius: '0.375rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    ...violetTheme.tokens,
    background: 'oklch(0.17 0.01 250)',
    foreground: 'oklch(0.92 0.005 240)',
    card: 'oklch(0.21 0.012 250)',
    'card-foreground': 'oklch(0.92 0.005 240)',
    popover: 'oklch(0.21 0.012 250)',
    'popover-foreground': 'oklch(0.92 0.005 240)',
    primary: 'oklch(0.60 0.18 255)',
    'primary-foreground': 'oklch(1 0 0)',
    secondary: 'oklch(0.27 0.012 250)',
    'secondary-foreground': 'oklch(0.90 0.005 240)',
    tertiary: 'oklch(0.31 0.012 250)',
    'tertiary-foreground': 'oklch(0.88 0.005 240)',
    muted: 'oklch(0.25 0.012 250)',
    'muted-foreground': 'oklch(0.68 0.01 245)',
    accent: 'oklch(0.30 0.05 255)',
    'accent-foreground': 'oklch(0.85 0.08 255)',
    destructive: 'oklch(0.62 0.20 22)',
    'destructive-foreground': 'oklch(0.98 0.01 22)',
    border: 'oklch(0.30 0.012 250)',
    input: 'oklch(0.30 0.012 250)',
    ring: 'oklch(0.60 0.18 255)',
    sidebar: 'oklch(0.19 0.01 250)',
    'sidebar-foreground': 'oklch(0.90 0.005 240)',
    'sidebar-primary': 'oklch(0.60 0.18 255)',
    'sidebar-primary-foreground': 'oklch(1 0 0)',
    'sidebar-accent': 'oklch(0.28 0.04 255)',
    'sidebar-accent-foreground': 'oklch(0.85 0.07 255)',
    'sidebar-border': 'oklch(0.26 0.012 250)',
    'sidebar-ring': 'oklch(0.60 0.18 255)',
    'chart-1': 'oklch(0.60 0.18 255)',
    'chart-2': 'oklch(0.72 0.16 150)',
    'chart-3': 'oklch(0.75 0.16 75)',
    'chart-4': 'oklch(0.68 0.16 300)',
    'chart-5': 'oklch(0.66 0.18 22)',
  },
};

const rosePineTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'violet',
  radius: '0.75rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    ...violetTheme.tokens,
    background: 'oklch(0.22 0.02 300)',
    foreground: 'oklch(0.90 0.02 295)',
    card: 'oklch(0.26 0.025 305)',
    'card-foreground': 'oklch(0.90 0.02 295)',
    popover: 'oklch(0.26 0.025 305)',
    'popover-foreground': 'oklch(0.90 0.02 295)',
    primary: 'oklch(0.76 0.09 300)',
    'primary-foreground': 'oklch(0.20 0.02 300)',
    secondary: 'oklch(0.32 0.025 310)',
    'secondary-foreground': 'oklch(0.88 0.02 295)',
    tertiary: 'oklch(0.36 0.025 310)',
    'tertiary-foreground': 'oklch(0.86 0.02 295)',
    muted: 'oklch(0.30 0.025 310)',
    'muted-foreground': 'oklch(0.74 0.03 295)',
    accent: 'oklch(0.70 0.13 0)',
    'accent-foreground': 'oklch(0.22 0.03 0)',
    destructive: 'oklch(0.70 0.13 0)',
    'destructive-foreground': 'oklch(0.98 0.01 0)',
    border: 'oklch(0.36 0.025 310)',
    input: 'oklch(0.36 0.025 310)',
    ring: 'oklch(0.76 0.09 300)',
    sidebar: 'oklch(0.20 0.02 300)',
    'sidebar-foreground': 'oklch(0.88 0.02 295)',
    'sidebar-primary': 'oklch(0.76 0.09 300)',
    'sidebar-primary-foreground': 'oklch(0.20 0.02 300)',
    'sidebar-accent': 'oklch(0.40 0.08 350)',
    'sidebar-accent-foreground': 'oklch(0.90 0.06 350)',
    'sidebar-border': 'oklch(0.30 0.025 310)',
    'sidebar-ring': 'oklch(0.76 0.09 300)',
    'chart-1': 'oklch(0.76 0.09 300)',
    'chart-2': 'oklch(0.70 0.13 0)',
    'chart-3': 'oklch(0.82 0.09 90)',
    'chart-4': 'oklch(0.78 0.08 200)',
    'chart-5': 'oklch(0.72 0.08 250)',
  },
};

const vercelTheme: NajmThemeConfig = {
  mode: 'light',
  accent: 'neutral',
  radius: '0.5rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    ...lightTheme.tokens,
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.18 0 0)',
    card: 'oklch(1 0 0)',
    'card-foreground': 'oklch(0.18 0 0)',
    popover: 'oklch(1 0 0)',
    'popover-foreground': 'oklch(0.18 0 0)',
    primary: 'oklch(0.18 0 0)',
    'primary-foreground': 'oklch(1 0 0)',
    secondary: 'oklch(0.96 0 0)',
    'secondary-foreground': 'oklch(0.22 0 0)',
    tertiary: 'oklch(0.93 0 0)',
    'tertiary-foreground': 'oklch(0.28 0 0)',
    muted: 'oklch(0.96 0 0)',
    'muted-foreground': 'oklch(0.55 0 0)',
    accent: 'oklch(0.95 0 0)',
    'accent-foreground': 'oklch(0.20 0 0)',
    destructive: 'oklch(0.58 0.22 27)',
    'destructive-foreground': 'oklch(1 0 0)',
    border: 'oklch(0.90 0 0)',
    input: 'oklch(0.90 0 0)',
    ring: 'oklch(0.18 0 0)',
    sidebar: 'oklch(0.985 0 0)',
    'sidebar-foreground': 'oklch(0.20 0 0)',
    'sidebar-primary': 'oklch(0.18 0 0)',
    'sidebar-primary-foreground': 'oklch(1 0 0)',
    'sidebar-accent': 'oklch(0.95 0 0)',
    'sidebar-accent-foreground': 'oklch(0.20 0 0)',
    'sidebar-border': 'oklch(0.92 0 0)',
    'sidebar-ring': 'oklch(0.18 0 0)',
    'chart-1': 'oklch(0.55 0.20 255)',
    'chart-2': 'oklch(0.65 0.18 150)',
    'chart-3': 'oklch(0.70 0.18 75)',
    'chart-4': 'oklch(0.60 0.20 300)',
    'chart-5': 'oklch(0.62 0.22 25)',
  },
};

const solarizedLightTheme: NajmThemeConfig = {
  mode: 'light',
  accent: 'blue',
  radius: '0.5rem',
  radiusScale: 'uniform',
  appearance: { borderWidth: '1px' },
  tokens: {
    ...lightTheme.tokens,
    background: 'oklch(0.97 0.02 90)',
    foreground: 'oklch(0.43 0.03 215)',
    card: 'oklch(0.98 0.015 90)',
    'card-foreground': 'oklch(0.43 0.03 215)',
    popover: 'oklch(0.98 0.015 90)',
    'popover-foreground': 'oklch(0.43 0.03 215)',
    primary: 'oklch(0.58 0.13 245)',
    'primary-foreground': 'oklch(0.99 0.01 90)',
    secondary: 'oklch(0.92 0.025 85)',
    'secondary-foreground': 'oklch(0.40 0.03 215)',
    tertiary: 'oklch(0.88 0.03 85)',
    'tertiary-foreground': 'oklch(0.40 0.03 215)',
    muted: 'oklch(0.92 0.025 85)',
    'muted-foreground': 'oklch(0.55 0.025 200)',
    accent: 'oklch(0.90 0.05 200)',
    'accent-foreground': 'oklch(0.40 0.08 215)',
    destructive: 'oklch(0.60 0.20 30)',
    'destructive-foreground': 'oklch(0.99 0.01 90)',
    border: 'oklch(0.86 0.03 85)',
    input: 'oklch(0.86 0.03 85)',
    ring: 'oklch(0.58 0.13 245)',
    sidebar: 'oklch(0.94 0.025 85)',
    'sidebar-foreground': 'oklch(0.43 0.03 215)',
    'sidebar-primary': 'oklch(0.58 0.13 245)',
    'sidebar-primary-foreground': 'oklch(0.99 0.01 90)',
    'sidebar-accent': 'oklch(0.88 0.05 200)',
    'sidebar-accent-foreground': 'oklch(0.40 0.08 215)',
    'sidebar-border': 'oklch(0.85 0.03 85)',
    'sidebar-ring': 'oklch(0.58 0.13 245)',
    'chart-1': 'oklch(0.58 0.13 245)',
    'chart-2': 'oklch(0.60 0.13 160)',
    'chart-3': 'oklch(0.70 0.15 70)',
    'chart-4': 'oklch(0.55 0.18 320)',
    'chart-5': 'oklch(0.60 0.20 30)',
  },
};

const themePresets = [
  { id: 'violet', label: 'Violet Studio', config: violetTheme },
  { id: 'emerald', label: 'Emerald School', config: emeraldTheme },
  { id: 'slate', label: 'Slate Admin', config: slateTheme },
  { id: 'tokyo', label: 'Tokyo Night', config: tokyoNightTheme },
  { id: 'dracula', label: 'Dracula', config: draculaTheme },
  { id: 'nord', label: 'Nord', config: nordTheme },
  { id: 'catppuccin', label: 'Catppuccin Mocha', config: catppuccinTheme },
  { id: 'github', label: 'GitHub Dark', config: githubDarkTheme },
  { id: 'rosepine', label: 'Rosé Pine', config: rosePineTheme },
  { id: 'light', label: 'Light Blue SaaS', config: lightTheme },
  { id: 'vercel', label: 'Vercel Light', config: vercelTheme },
  { id: 'solarized', label: 'Solarized Light', config: solarizedLightTheme },
] as const;

const modeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const accentOptions = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'slate', label: 'Slate' },
  { value: 'blue', label: 'Blue' },
  { value: 'violet', label: 'Violet' },
  { value: 'emerald', label: 'Emerald' },
  { value: 'green', label: 'Green' },
];

const radiusOptions = [
  { value: '0', label: 'None — 0' },
  { value: '0.25rem', label: 'Small — 0.25rem' },
  { value: '0.5rem', label: 'Default — 0.5rem' },
  { value: '0.75rem', label: 'Medium — 0.75rem' },
  { value: '1rem', label: 'Large — 1rem' },
  { value: '1.5rem', label: 'Extra large — 1.5rem' },
];

const borderWidthOptions = [
  { value: '0', label: 'None — 0' },
  { value: '1px', label: 'Thin — 1px' },
  { value: '2px', label: 'Medium — 2px' },
  { value: '3px', label: 'Thick — 3px' },
];

type TokenCategoryId = 'surfaces' | 'brand' | 'status' | 'sidebar' | 'charts';
type TokenField = { key: keyof NajmThemeTokens; label: string; hint: string };

const tokenCategories = [
  {
    id: 'surfaces',
    label: 'Surface colors',
    description: 'App background, cards, popovers, and muted areas.',
    fields: [
      { key: 'background', label: 'Background', hint: 'Main app canvas.' },
      { key: 'foreground', label: 'Foreground', hint: 'Default text color.' },
      { key: 'card', label: 'Card', hint: 'Cards, panels, and table shells.' },
      { key: 'card-foreground', label: 'Card foreground', hint: 'Text inside card surfaces.' },
      { key: 'popover', label: 'Popover', hint: 'Dropdowns, menus, sheets, and floating surfaces.' },
      { key: 'popover-foreground', label: 'Popover foreground', hint: 'Text inside floating surfaces.' },
      { key: 'muted', label: 'Muted', hint: 'Muted blocks, rows, and soft sections.' },
      { key: 'muted-foreground', label: 'Muted foreground', hint: 'Secondary text and descriptions.' },
    ],
  },
  {
    id: 'brand',
    label: 'Brand colors',
    description: 'Primary action colors plus secondary, tertiary, and accent tones.',
    fields: [
      { key: 'primary', label: 'Primary', hint: 'Main brand color — also sets ring, sidebar, and chart-1.' },
      { key: 'primary-foreground', label: 'Primary foreground', hint: 'Text/icons on primary.' },
      { key: 'secondary', label: 'Secondary', hint: 'Secondary buttons and soft controls.' },
      { key: 'secondary-foreground', label: 'Secondary foreground', hint: 'Text/icons on secondary.' },
      { key: 'tertiary', label: 'Tertiary', hint: 'Optional third-level action color.' },
      { key: 'tertiary-foreground', label: 'Tertiary foreground', hint: 'Text/icons on tertiary.' },
      { key: 'accent', label: 'Accent', hint: 'Hover and selected background accents.' },
      { key: 'accent-foreground', label: 'Accent foreground', hint: 'Text/icons on accent.' },
      { key: 'ring', label: 'Ring', hint: 'Focus ring and highlights.' },
    ],
  },
  {
    id: 'status',
    label: 'Status colors',
    description: 'Error/destructive colors and their readable foreground.',
    fields: [
      { key: 'destructive', label: 'Destructive', hint: 'Danger buttons and errors.' },
      { key: 'destructive-foreground', label: 'Destructive foreground', hint: 'Text/icons on destructive.' },
    ],
  },
  {
    id: 'sidebar',
    label: 'Sidebar colors',
    description: 'Sidebar surface, text, and active navigation. The rest is derived.',
    fields: [
      { key: 'sidebar', label: 'Sidebar', hint: 'Sidebar background.' },
      { key: 'sidebar-foreground', label: 'Sidebar foreground', hint: 'Sidebar text.' },
      { key: 'sidebar-accent', label: 'Active nav background', hint: 'Selected route background.' },
      { key: 'sidebar-accent-foreground', label: 'Active nav text', hint: 'Selected route text color.' },
    ],
  },
  {
    id: 'charts',
    label: 'Chart colors',
    description: 'Chart palettes used by analytics and data visualization.',
    fields: [
      { key: 'chart-1', label: 'Chart 1', hint: 'Primary chart series.' },
      { key: 'chart-2', label: 'Chart 2', hint: 'Secondary chart series.' },
      { key: 'chart-3', label: 'Chart 3', hint: 'Tertiary chart series.' },
      { key: 'chart-4', label: 'Chart 4', hint: 'Fourth chart series.' },
      { key: 'chart-5', label: 'Chart 5', hint: 'Fifth chart series.' },
    ],
  },
] as const satisfies readonly {
  id: TokenCategoryId;
  label: string;
  description: string;
  fields: readonly TokenField[];
}[];

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Customers', icon: Users },
  { label: 'Orders', icon: Package },
  { label: 'Billing', icon: CreditCard },
  { label: 'Security', icon: Shield },
  { label: 'Settings', icon: Settings },
];

const tableRows = [
  { name: 'Fahd Moujahid', plan: 'Guardian', status: 'Active', amount: '$2,430' },
  { name: 'Mina El Harrak', plan: 'Admin', status: 'Invited', amount: '$980' },
  { name: 'Yassine Karim', plan: 'Member', status: 'Active', amount: '$1,280' },
];

const exampleCode = [
  '// theme.json',
  '{',
  '  "mode": "dark",',
  '  "accent": "violet",',
  '  "radius": "0.85rem",',
  '  "radiusScale": "uniform",',
  '  "appearance": { "borderWidth": "1px" },',
  '  "tokens": {',
  '    "background": "oklch(0.145 0.024 285.7)",',
  '    "card": "oklch(0.21 0.034 285.3)",',
  '    "primary": "oklch(0.62 0.24 292)",',
  '    "primary-foreground": "oklch(1 0 0)",',
  '    "sidebar": "oklch(0.18 0.03 286)",',
  '    "sidebar-foreground": "oklch(0.94 0.01 286)",',
  '    "chart-1": "oklch(0.70 0.22 292)"',
  '  }',
  '}',
  '',
  '// App.tsx',
  "import rawTheme from './theme.json';",
  "import { NajmThemeProvider, parseNajmThemeConfig } from 'najm-kit';",
  '',
  'const initialTheme = parseNajmThemeConfig(rawTheme);',
  '',
  'export function App() {',
  '  const [theme, setTheme] = useState(initialTheme);',
  '',
  '  return (',
  '    <NajmThemeProvider config={theme}>',
  '      <SettingsPage value={theme} onChange={setTheme} />',
  '      <Dashboard />',
  '    </NajmThemeProvider>',
  '  );',
  '}',
].join('\\n');

function cloneThemeConfig(config: NajmThemeConfig): NajmThemeConfig {
  return JSON.parse(JSON.stringify(config)) as NajmThemeConfig;
}

// Editing a base token should keep its derived tokens in sync, so one swatch
// change recolors the whole brand instead of leaving stale values behind.
const LINKED_TOKENS: Partial<Record<keyof NajmThemeTokens, (keyof NajmThemeTokens)[]>> = {
  primary: ['ring', 'sidebar-primary', 'sidebar-ring', 'chart-1'],
};

// composePreset only emits surfaces + 5 accent tokens — no sidebar/chart keys.
// Derive those from the composed palette so the sidebar (and charts) track the
// chosen mode/accent instead of falling back to the static stylesheet defaults.
function composeFullPalette(mode: NajmMode, accent: NajmAccent): NajmThemeTokens {
  const base = composePreset(mode, accent);
  return {
    ...base,
    sidebar: base.card,
    'sidebar-foreground': base.foreground,
    'sidebar-primary': base.primary,
    'sidebar-primary-foreground': base['primary-foreground'],
    'sidebar-accent': base.accent,
    'sidebar-accent-foreground': base['accent-foreground'],
    'sidebar-border': base.border,
    'sidebar-ring': base.ring,
    'chart-1': base.primary,
    'chart-2': base.accent,
    'chart-3': base.ring,
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

const tokenColorFallbacks: Partial<Record<keyof NajmThemeTokens, string>> = {
  background: '#111827',
  foreground: '#f8fafc',
  card: '#1f2937',
  'card-foreground': '#f8fafc',
  popover: '#1f2937',
  'popover-foreground': '#f8fafc',
  primary: '#10b981',
  'primary-foreground': '#ffffff',
  secondary: '#334155',
  'secondary-foreground': '#e2e8f0',
  tertiary: '#475569',
  'tertiary-foreground': '#e2e8f0',
  muted: '#334155',
  'muted-foreground': '#94a3b8',
  accent: '#164e3b',
  'accent-foreground': '#bbf7d0',
  destructive: '#dc2626',
  'destructive-foreground': '#ffffff',
  border: '#475569',
  
  
  input: '#475569',
  ring: '#10b981',
  sidebar: '#0f172a',
  'sidebar-foreground': '#f8fafc',
  'sidebar-primary': '#10b981',
  'sidebar-primary-foreground': '#ffffff',
  'sidebar-accent': '#164e3b',
  'sidebar-accent-foreground': '#bbf7d0',
  'sidebar-border': '#334155',
  'sidebar-ring': '#10b981',
  'chart-1': '#10b981',
  'chart-2': '#3b82f6',
  'chart-3': '#f59e0b',
  'chart-4': '#a855f7',
  'chart-5': '#ef4444',
};

// Convert any CSS color (oklch, rgb, named, hex) to a 6-digit hex string using
// the browser's own color engine via a canvas — no dependency. Returns '' if
// the input can't be parsed, so callers can fall back.
let _hexCanvasCtx: CanvasRenderingContext2D | null | undefined;
function toHexColor(input: string): string {
  const v = (input ?? '').trim();
  if (!v) return '';
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  if (typeof document === 'undefined') return '';
  if (_hexCanvasCtx === undefined) _hexCanvasCtx = document.createElement('canvas').getContext('2d');
  const ctx = _hexCanvasCtx;
  if (!ctx) return '';
  // Double-parse against two sentinels: a valid color resolves the same both
  // times; an invalid one leaves each sentinel untouched (and they differ).
  ctx.fillStyle = '#000000';
  ctx.fillStyle = v;
  const a = ctx.fillStyle;
  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = v;
  const b = ctx.fillStyle;
  if (a !== b) return '';
  return typeof a === 'string' && a.startsWith('#') ? a.toLowerCase() : '';
}

function colorInputValue(value: string, tokenKey: keyof NajmThemeTokens) {
  return toHexColor(value) || tokenColorFallbacks[tokenKey] || '#000000';
}

function ColorTokenRow({
  field,
  value,
  onChange,
}: {
  field: TokenField;
  value: string;
  onChange: (value: string) => void;
}) {
  // The editor works in hex; oklch (or any CSS color) from presets is converted
  // for display. Edits store hex — converted back to oklch in the save phase.
  const [textDraft, setTextDraft] = useState(() => colorInputValue(value, field.key));
  const [pickerDraft, setPickerDraft] = useState(() => colorInputValue(value, field.key));
  const commitTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setTextDraft(colorInputValue(value, field.key));
    setPickerDraft(colorInputValue(value, field.key));
  }, [field.key, value]);

  React.useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  const commitColor = (nextValue: string, delay = 140) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      onChange(nextValue);
      commitTimer.current = null;
    }, delay);
  };

  const flushColor = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
    onChange(pickerDraft);
  };

  return (
    <div className="flex items-center gap-2.5 border-b border-border/50 py-1.5 last:border-b-0">
      {/* Swatch shows the current hex; the native color input sits on top
          transparently so it still opens the picker. */}
      <span
        className="relative size-7 shrink-0 overflow-hidden rounded-md border border-border"
        style={{ background: textDraft || pickerDraft }}
      >
        <input
          aria-label={`${field.label} color`}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          type="color"
          value={pickerDraft}
          onInput={(event) => {
            const nextValue = event.currentTarget.value;
            setPickerDraft(nextValue);
            setTextDraft(nextValue);
            commitColor(nextValue);
          }}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            setPickerDraft(nextValue);
            setTextDraft(nextValue);
            commitColor(nextValue);
          }}
          onBlur={flushColor}
          title={textDraft}
        />
      </span>
      <label className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={field.hint}>
        {field.label}
      </label>
      <TextInput
        className="w-[148px] shrink-0 font-mono !text-[11px]"
        value={textDraft}
        onChange={(nextValue) => {
          setTextDraft(nextValue);
          onChange(nextValue);
        }}
        placeholder="#10b981"
        bordered
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
}) {
  return (
    <NCard className="bg-card/90 p-4 shadow-sm" >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon size={18} />
        </div>
      </div>
      <Badge className="mt-4 border-primary/20 bg-primary/10 text-primary" variant="outline">
        {change}
      </Badge>
    </NCard>
  );
}

function DashboardPreview({
  config,
  onConfigChange,
}: {
  config: NajmThemeConfig;
  onConfigChange: React.Dispatch<React.SetStateAction<NajmThemeConfig>>;
}) {
  const jsonPreview = useMemo(() => stringifyNajmThemeConfig(config), [config]);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [selectedPreparedExample, setSelectedPreparedExample] = useState('');
  const [tokenCategory, setTokenCategory] = useState<TokenCategoryId>('brand');
  const surfaceBorderWidth = config.appearance?.borderWidth ?? '1px';
  // Per-mode border (+ input): a border you set in dark mode is stored as the
  // dark border, one set in light mode as the light border. Toggling Mode shows
  // the value already saved for that mode, so you build a light + a dark theme.
  const [borderByMode, setBorderByMode] = useState<Partial<Record<NajmMode, string>>>({});
  const activeMode: NajmMode = config.mode ?? 'light';
  const updateRoot = <Key extends keyof NajmThemeConfig>(key: Key, value: NajmThemeConfig[Key]) => {
    setSelectedPreparedExample('');
    onConfigChange((current) => ({ ...current, [key]: value }));
  };
  // Mode + accent regenerate the base token palette via composePreset, so they
  // actually drive the colors (tokens always win in the provider). The Color
  // tokens section below then fine-tunes the generated palette.
  // Base palette (mode + accent) always regenerates a coherent token set, so
  // selecting an accent or flipping light/dark visibly recolors every token
  // (and the border flips smartly). Radius and border width are kept.
  const updatePalette = (next: { mode?: NajmMode; accent?: NajmAccent }) => {
    setSelectedPreparedExample('');
    onConfigChange((current) => {
      const mode = next.mode ?? current.mode ?? 'light';
      const accent = next.accent ?? current.accent ?? 'neutral';
      const tokens = composeFullPalette(mode, accent);
      // Apply the border already saved for the mode we're switching to, so
      // toggling light/dark shows that mode's border instead of the default.
      const storedBorder = borderByMode[mode];
      if (storedBorder) {
        tokens.border = storedBorder;
        tokens.input = storedBorder;
      }
      return { ...current, mode, accent, tokens };
    });
  };
  const updateAppearance = (borderWidth: string) => {
    setSelectedPreparedExample('');
    onConfigChange((current) => ({
      ...current,
      appearance: { ...current.appearance, borderWidth },
    }));
  };
  // Set the border (and input) for the current mode and remember it, so the
  // value is restored when you toggle back to this mode later.
  const updateBorderForMode = (value: string) => {
    setSelectedPreparedExample('');
    setBorderByMode((prev) => ({ ...prev, [activeMode]: value || undefined }));
    onConfigChange((current) => ({
      ...current,
      tokens: { ...current.tokens, border: value || undefined, input: value || undefined },
    }));
  };
  const updateToken = (key: keyof NajmThemeTokens, value: string) => {
    setSelectedPreparedExample('');
    onConfigChange((current) => {
      const tokens = { ...current.tokens, [key]: value || undefined };
      const linked = LINKED_TOKENS[key];
      if (linked && value) {
        for (const linkedKey of linked) tokens[linkedKey] = value;
      }
      return { ...current, tokens };
    });
  };
  const applyPreparedExample = (presetId: string) => {
    const preset = themePresets.find((item) => item.id === presetId);
    if (!preset) return;
    setSelectedPreparedExample(presetId);
    setBorderByMode({});
    onConfigChange(cloneThemeConfig(preset.config));
  };

  return (
    <NajmThemeProvider config={config} className={config.mode === 'dark' ? 'dark' : ''}>
      <div className="overflow-hidden rounded-xl najm-border border-border bg-background text-foreground shadow-2xl">
        <div className="flex min-h-[620px]">
          <aside className="hidden w-60 shrink-0 flex-col najm-border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
            <div className="flex h-16 items-center gap-3 najm-border-b border-sidebar-border px-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">Najm School</p>
                <p className="text-xs text-sidebar-foreground/60">Theme from JSON</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map(({ label, icon: Icon, active }) => (
                <button
                  key={label}
                  className={[
                    'flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                  ].join(' ')}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
            <div className="m-3 rounded-lg najm-border border-sidebar-border bg-sidebar-accent/50 p-3">
              <p className="text-xs font-semibold">Radius</p>
              <p className="mt-1 text-xs text-sidebar-foreground/65">{config.radius} / {config.radiusScale}</p>
            </div>
          </aside>

          <main className="min-w-0 flex-1 bg-background">
            <header className="flex h-16 items-center gap-3 najm-border-b border-border bg-card/70 px-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Dashboard</p>
                <p className="text-xs text-muted-foreground">Every surface below reads from one JSON config.</p>
              </div>
              <div className="hidden h-9 w-56 items-center gap-2 rounded-md najm-border border-input bg-background px-3 text-sm text-muted-foreground sm:flex">
                <Search size={14} />
                Search records...
              </div>
              <NButton variant="outline" size="icon" aria-label="Notifications">
                <Bell size={16} />
              </NButton>
              <NButton
                leftIcon={Palette}
                aria-expanded={customizerOpen}
                onClick={() => setCustomizerOpen(true)}
              >
                Customize
              </NButton>
            </header>

            <div className="space-y-5 p-4 lg:p-6">
              <section className="grid gap-3 md:grid-cols-3">
                <MetricCard title="Revenue" value="$42.8k" change="+18.4%" icon={BarChart3}  />
                <MetricCard title="Students" value="1,284" change="+126 this week" icon={Users}  />
                <MetricCard title="Activity" value="92%" change="Healthy" icon={Activity}  />
              </section>

              <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <NCard
                  title="Recent guardians"
                  description="Table shell, badges, buttons, and rows share the radius."
                >
                  <div className="overflow-hidden rounded-lg najm-border border-border">
                    <div className="grid grid-cols-[1fr_110px_110px_90px] gap-3 border-b border-border bg-muted/45 px-3 py-2 text-xs font-semibold text-muted-foreground">
                      <span>Name</span>
                      <span>Plan</span>
                      <span>Status</span>
                      <span className="text-right">Amount</span>
                    </div>
                    {tableRows.map((row) => (
                      <div key={row.name} className="grid grid-cols-[1fr_110px_110px_90px] items-center gap-3 border-b border-border/70 px-3 py-3 text-sm last:border-b-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                            {row.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                          </div>
                          <span className="truncate font-medium">{row.name}</span>
                        </div>
                        <span className="text-muted-foreground">{row.plan}</span>
                        <Badge variant={row.status === 'Active' ? 'default' : 'secondary'}>{row.status}</Badge>
                        <span className="text-right font-semibold">{row.amount}</span>
                      </div>
                    ))}
                  </div>
                </NCard>

                <NCard
                  title="Current JSON"
                  description="Persist this object from your settings page."
                
                >
                  <pre className="max-h-[255px] overflow-auto rounded-lg najm-border border-border bg-muted/35 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    {jsonPreview}
                  </pre>
                  <div className="mt-4 flex gap-2">
                    <NButton className="flex-1" size="sm">Save theme</NButton>
                    <NButton className="flex-1" variant="outline" size="sm">Export JSON</NButton>
                  </div>
                </NCard>
              </section>
            </div>
          </main>
        </div>
      </div>

      <NSheet
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        title="Customize theme"
        width={440}
        contentClassName="bg-background"
        footer={(
          <div className="flex gap-2">
            <NButton className="flex-1" variant="outline" onClick={() => setCustomizerOpen(false)}>
              Close
            </NButton>
            <NButton className="flex-1" onClick={() => setCustomizerOpen(false)}>
              Save theme
            </NButton>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/80 px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground">Live JSON</p>
            <p className="text-sm">
              {config.mode ?? 'light'} / {config.accent ?? 'neutral'} / {config.radius ?? 'default'}
            </p>
          </div>

          <div className="space-y-2">
            <FieldLabel>Saved themes</FieldLabel>
            <SelectInput
              value={selectedPreparedExample}
              onChange={applyPreparedExample}
              items={themePresets.map((preset) => ({ value: preset.id, label: preset.label }))}
              placeholder="Load a world-class theme"
              bordered
            
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Base palette</FieldLabel>
            <SelectInput
              value={config.mode ?? 'light'}
              onChange={(value) => updatePalette({ mode: value as NajmMode })}
              items={modeOptions}
              placeholder="Mode"
              bordered
            
            />
            <SelectInput
              value={config.accent ?? 'neutral'}
              onChange={(value) => updatePalette({ accent: value as NajmAccent })}
              items={accentOptions}
              placeholder="Accent"
              bordered
            
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Shape</FieldLabel>
            <SelectInput
              value={config.radius ?? '0.5rem'}
              onChange={(value) => updateRoot('radius', value || undefined)}
              items={radiusOptions}
              placeholder="Corner radius"
              bordered
            />
            <SelectInput
              value={surfaceBorderWidth}
              onChange={(value) => updateAppearance(value)}
              items={borderWidthOptions}
              placeholder="Border width"
              bordered
            />
            <ColorTokenRow
              field={{
                key: 'border',
                label: `Border · ${activeMode}`,
                hint: 'Border + input color, saved per mode. Toggle Mode to set the other.',
              }}
              value={config.tokens?.border ?? ''}
              onChange={updateBorderForMode}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Color tokens</FieldLabel>
            <div className="space-y-2">
              {tokenCategories.map((category) => {
                const isOpen = tokenCategory === category.id;
                const previewFields = category.fields.slice(0, 3);

              return (
                  <section key={category.id} className="overflow-hidden rounded-lg border border-border bg-card/45">
                    <button
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setTokenCategory(category.id)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{category.label}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {previewFields.map((field) => {
                          const value = config.tokens?.[field.key] ?? '';

                          return (
                            <span
                              key={field.key}
                              aria-hidden="true"
                              className="size-4 rounded border border-border"
                              style={{ background: value || colorInputValue('', field.key) }}
                            />
                          );
                        })}
                        <span className="ml-1 text-xs font-semibold text-muted-foreground">
                          {isOpen ? 'Close' : 'Edit'}
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border px-3 py-2">
                        {category.fields.map((field) => (
                          <ColorTokenRow
                            key={field.key}
                            field={field}
                            value={config.tokens?.[field.key] ?? ''}
                          
                            onChange={(value) => updateToken(field.key, value)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </NSheet>
    </NajmThemeProvider>
  );
}

export function ThemeJsonPage() {
  const [editableTheme, setEditableTheme] = useState<NajmThemeConfig>(() => cloneThemeConfig(violetTheme));

  return (
    <ComponentPage
      title="JSON Theme Dashboard"
      description="A full dashboard example where sidebar, buttons, cards, table rows, badges, border contrast, and radius all come from one JSON object. Click Customize to load a world-class preset and edit every token."
      category="Getting Started"
    >
      <div className="space-y-6">
        <DashboardPreview config={editableTheme} onConfigChange={setEditableTheme} />

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Consumer setup</h2>
            <p className="mt-1 text-sm text-slate-400">
              Keep this JSON in a file, database row, or local storage. Parse it once, then pass it to the provider.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800/80">
            <CodeBlock code={exampleCode} lang="tsx" bare />
          </div>
        </div>
      </div>
    </ComponentPage>
  );
}
