import React, { useMemo, useRef, useState } from 'react';
import {
  Badge,
  composePreset,
  NButton,
  NCard,
  NPageHeader,
  NPageLayout,
  NThemeCustomizer,
  NSheet,
  NajmDesignProvider,
  parseThemeFile,
  SelectInput,
  stringifyThemeFile,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  stringifyNajmDesignConfig,
  type NajmAccent,
  type NajmDesignConfig,
  type NajmMode,
  type NajmThemeConfig,
  type NajmThemeTokens,
} from 'najm-kit';
import {
  Activity,
  BarChart3,
  Bell,
  CreditCard,
  Download,
  LayoutDashboard,
  Package,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { CodeBlock } from '../CodeBlock';

const violetTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'violet',
  radius: '14px',
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
  radius: '8px',
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
  radius: '18px',
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
  radius: '8px',
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

// â”€â”€ World-class presets (popular design systems & editor themes) â”€â”€

const tokyoNightTheme: NajmThemeConfig = {
  mode: 'dark',
  accent: 'blue',
  radius: '10px',
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
  radius: '8px',
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
  radius: '8px',
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
  radius: '14px',
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
  radius: '6px',
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
  radius: '12px',
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
  radius: '8px',
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
  radius: '8px',
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
  { id: 'rosepine', label: 'RosÃ© Pine', config: rosePineTheme },
  { id: 'light', label: 'Light Blue SaaS', config: lightTheme },
  { id: 'vercel', label: 'Vercel Light', config: vercelTheme },
  { id: 'solarized', label: 'Solarized Light', config: solarizedLightTheme },
] as const;

const modeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

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
  '// design.json',
  '{',
  '  "version": 1,',
  '  "theme": {',
  '    "mode": "dark",',
  '    "accent": "violet",',
  '    "radius": "14px",',
  '    "tokens": {',
  '      "background": "oklch(0.145 0.024 285.7)",',
  '      "primary": "oklch(0.62 0.24 292)",',
  '      "sidebar": "oklch(0.18 0.03 286)"',
  '    }',
  '  },',
  '  "typography": { "baseSize": "16px", "scale": "default" },',
  '  "layout": { "pageGutter": "24px", "sectionGap": "20px" }',
  '}',
  '',
  '// App.tsx',
  "import rawDesign from './design.json';",
  "import { NThemeCustomizer, NajmDesignProvider, parseNajmDesignConfig } from 'najm-kit';",
  '',
  'const initialDesign = parseNajmDesignConfig(rawDesign);',
  '',
  'export function App() {',
  '  const [design, setDesign] = useState(initialDesign);',
  "  const [previewMode, setPreviewMode] = useState(design.theme.mode ?? 'light');",
  '',
  '  return (',
  '    <NajmDesignProvider config={design} mode={previewMode}>',
  '      <ThemeModeSelect value={previewMode} onChange={setPreviewMode} />',
  '      <NThemeCustomizer',
  '        value={design}',
  '        factoryValue={initialDesign}',
  '        onChange={setDesign}',
  '      />',
  '      <Dashboard />',
  '    </NajmDesignProvider>',
  '  );',
  '}',
].join('\\n');

function cloneDesignConfig(config: NajmDesignConfig): NajmDesignConfig {
  return JSON.parse(JSON.stringify(config)) as NajmDesignConfig;
}

const dashboardFactory: NajmDesignConfig = {
  version: 1,
  theme: violetTheme,
  typography: {
    fontSans: "'Inter', ui-sans-serif, system-ui, sans-serif",
    fontHeading: "'Manrope', ui-sans-serif, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, Consolas, monospace",
    baseSize: '16px',
    scale: 'default',
    lineHeight: '1.5',
  },
  components: {
    pageHeader: { card: false },
    sidebar: { showSectionLabels: true, showSectionSeparators: true },
    input: { borderWidth: '1px' },
  },
  layout: { pageGutter: '24px', sectionGap: '20px' },
};

const fontOptions = [
  { value: "'Inter', ui-sans-serif, system-ui, sans-serif", label: 'Inter' },
  { value: "'Manrope', ui-sans-serif, system-ui, sans-serif", label: 'Manrope' },
  { value: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif", label: 'Plus Jakarta Sans' },
  { value: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif", label: 'IBM Plex Sans' },
  { value: "'JetBrains Mono', ui-monospace, Consolas, monospace", label: 'JetBrains Mono' },
];

// composePreset only emits surfaces + 5 accent tokens â€” no sidebar/chart keys.
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
  config: NajmDesignConfig;
  onConfigChange: React.Dispatch<React.SetStateAction<NajmDesignConfig>>;
}) {
  const jsonPreview = useMemo(() => stringifyNajmDesignConfig(config), [config]);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [selectedPreparedExample, setSelectedPreparedExample] = useState('');
  const themeFileInputRef = useRef<HTMLInputElement>(null);
  const [previewMode, setPreviewMode] = useState<NajmMode>(config.theme.mode ?? 'light');
  const [factoryValue, setFactoryValue] = useState<NajmDesignConfig>(() => cloneDesignConfig(config));
  const theme = config.theme;

  const importThemeFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const imported = parseThemeFile(await file.text());
    setSelectedPreparedExample('');
    onConfigChange(imported);
  };

  const exportThemeFile = () => {
    const url = URL.createObjectURL(
      new Blob([stringifyThemeFile(config)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'najm-theme.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Preset generation is dashboard workflow, not editor behavior. It stays
  // above the shared customizer and produces a coherent palette in one action.
  const updatePalette = (next: { mode?: NajmMode; accent?: NajmAccent }) => {
    setSelectedPreparedExample('');
    onConfigChange((current) => {
      const mode = next.mode ?? current.theme.mode ?? 'light';
      const accent = next.accent ?? current.theme.accent ?? 'neutral';
      const tokens = composeFullPalette(mode, accent);
      return {
        ...current,
        theme: { ...current.theme, mode, accent, tokens, overrides: undefined },
      };
    });
    if (next.mode) setPreviewMode(next.mode);
  };

  const applyPreparedExample = (presetId: string) => {
    const preset = themePresets.find((item) => item.id === presetId);
    if (!preset) return;
    const nextConfig: NajmDesignConfig = {
      ...config,
      theme: JSON.parse(JSON.stringify(preset.config)) as NajmThemeConfig,
    };
    setSelectedPreparedExample(presetId);
    setPreviewMode(preset.config.mode ?? 'light');
    setFactoryValue(cloneDesignConfig(nextConfig));
    onConfigChange(nextConfig);
  };

  return (
    <NajmDesignProvider config={config} mode={previewMode} className={previewMode === 'dark' ? 'dark' : ''}>
      <div className="overflow-hidden rounded-xl najm-border border-border bg-background text-foreground shadow-2xl">
        <div className="flex min-h-[620px]">
          <aside className="hidden w-60 shrink-0 flex-col najm-border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
            <div className="flex h-16 items-center gap-3 najm-border-b border-sidebar-border px-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">Najm School</p>
                <p className="text-xs text-sidebar-foreground/60">Design from JSON</p>
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
              <p className="mt-1 text-xs text-sidebar-foreground/65">{theme.radius}</p>
            </div>
          </aside>

          <main className="min-w-0 flex-1 bg-background">
            <NPageLayout as="div">
              <NPageHeader
                icon={LayoutDashboard}
                title="Dashboard"
                subtitle="Every surface below reads from one JSON config."
                search={{ placeholder: 'Search records...' }}
                actions={(
                  <>
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
                  </>
                )}
              />

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
            </NPageLayout>
          </main>
        </div>
      </div>

      <NSheet
        icon={Palette}
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        title="Customize theme"
        width={440}
        contentClassName="bg-background"
        footer={(
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                ref={themeFileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(event) => void importThemeFile(event)}
              />
              <NButton
                variant="outline"
                size="icon-sm"
                aria-label="Import theme"
                title="Import theme"
                onClick={() => themeFileInputRef.current?.click()}
              >
                <Upload />
              </NButton>
              <NButton
                variant="outline"
                size="icon-sm"
                aria-label="Export theme"
                title="Export theme"
                onClick={exportThemeFile}
              >
                <Download />
              </NButton>
              <NButton
                variant="outline"
                size="icon-sm"
                aria-label="Reset theme"
                title="Reset theme"
                onClick={() => {
                  setSelectedPreparedExample('');
                  onConfigChange(cloneDesignConfig(factoryValue));
                }}
              >
                <RotateCcw />
              </NButton>
            </div>
            <NButton
              size="icon-sm"
              aria-label="Save theme"
              title="Save theme"
              onClick={() => setCustomizerOpen(false)}
            >
              <Save />
            </NButton>
          </div>
        )}
      >
        <div className="space-y-3">
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
            <FieldLabel>Theme mode</FieldLabel>
            <SelectInput
              value={theme.mode ?? 'light'}
              onChange={(value) => updatePalette({ mode: value as NajmMode })}
              items={modeOptions}
              placeholder="Theme mode"
              bordered
            />
          </div>

          <div className="border-t border-border pt-4">
            <NThemeCustomizer
              value={config}
              factoryValue={factoryValue}
              onChange={(nextConfig) => {
                setSelectedPreparedExample('');
                onConfigChange(nextConfig);
              }}
              fontOptions={fontOptions}
              showFileActions={false}
              showResetAction={false}
            />
          </div>
        </div>
      </NSheet>
    </NajmDesignProvider>
  );
}

export function ThemeJsonPage() {
  const [editableDesign, setEditableDesign] = useState<NajmDesignConfig>(() =>
    cloneDesignConfig(dashboardFactory),
  );

  return (
    <ComponentPage
      title="JSON Design Dashboard"
      description="A full dashboard where theme, typography, component recipes, and layout come from one JSON object. Click Customize to load a preset and edit the complete design in the shared customizer."
      category="Getting Started"
    >
      <div className="space-y-6">
        <DashboardPreview config={editableDesign} onConfigChange={setEditableDesign} />

        <ThemeJsonEmbeddedPanel />

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Consumer setup</h2>
            <p className="mt-1 text-sm text-slate-400">
              Keep this design JSON in a file, database row, or local storage. Parse it once, then pass it to the provider.
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

const embeddedExampleCode = [
  '<Tabs defaultValue="theme">',
  '  <TabsList variant="pills">',
  '    <TabsTrigger value="theme" variant="pills">Theme</TabsTrigger>',
  '    <TabsTrigger value="about" variant="pills">About</TabsTrigger>',
  '  </TabsList>',
  '  <TabsContent value="theme">',
  '    <NThemeCustomizer',
  '      tabs={["theme"]}',
  '      showTabs={false}',
  '      value={draft}',
  '      factoryValue={factoryDesign}',
  '      onChange={setDraft}',
  '      previewMode={previewMode}',
  '      onPreviewModeChange={setPreviewMode}',
  '      showPreviewMode',
  '    />',
  '  </TabsContent>',
  '  <TabsContent value="about">…</TabsContent>',
  '</Tabs>',
].join('\\n');

export function ThemeJsonEmbeddedPanel() {
  const [hostValue, setHostValue] = useState<NajmDesignConfig>(() =>
    cloneDesignConfig(dashboardFactory),
  );
  const [hostFactory] = useState<NajmDesignConfig>(() =>
    cloneDesignConfig(dashboardFactory),
  );
  const [hostMode, setHostMode] = useState<NajmMode>(
    dashboardFactory.theme.mode ?? 'light',
  );

  return (
    <NajmDesignProvider
      config={hostValue}
      mode={hostMode}
      className={hostMode === 'dark' ? 'dark' : ''}
    >
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Host tab embedding</h2>
          <p className="mt-1 text-sm text-slate-400">
            Pass <code className="rounded bg-slate-800/60 px-1 py-0.5 text-[12px]">showTabs={'{false}'}</code> to render one section directly
            inside your own tab list. The host keeps its own tabs and the existing light/dark preview control stays available.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-background">
          <Tabs defaultValue="theme">
            <TabsList variant="pills" className="m-4">
              <TabsTrigger value="theme" variant="pills">Theme</TabsTrigger>
              <TabsTrigger value="about" variant="pills">About</TabsTrigger>
            </TabsList>
            <TabsContent value="theme" className="px-4 pb-4">
              <NThemeCustomizer
                tabs={['theme']}
                showTabs={false}
                value={hostValue}
                factoryValue={hostFactory}
                onChange={setHostValue}
                previewMode={hostMode}
                onPreviewModeChange={setHostMode}
                showPreviewMode
              />
            </TabsContent>
            <TabsContent value="about" className="px-4 pb-4">
              <p className="text-sm text-muted-foreground">
                The host application owns the tab header. The Najm customizer renders Theme controls plus the
                Components/Layout subsection below them without rendering its own nested tab bar.
              </p>
            </TabsContent>
          </Tabs>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800/80">
          <CodeBlock code={embeddedExampleCode} lang="tsx" bare />
        </div>
      </section>
    </NajmDesignProvider>
  );
}
