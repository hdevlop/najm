import { composePreset, type NajmDesignConfig } from "najm-kit";

export type StudioThemeMode = "light" | "dark";

export interface StudioPreset {
  id: string;
  name: string;
  config: NajmDesignConfig;
  modes?: Partial<Record<StudioThemeMode, NajmDesignConfig>>;
}

/**
 * Expands a preset's theme so its `tokens` map is fully populated from the
 * resolved mode+accent palette. This lets the studio show real swatch colors
 * and gives token edits a concrete baseline. Explicit token overrides win.
 */
function withResolvedTokens(config: NajmDesignConfig): NajmDesignConfig {
  const { mode = "light", accent = "neutral", tokens } = config.theme;
  const base = composePreset(mode, accent);
  return {
    ...config,
    theme: { ...config.theme, tokens: { ...base, ...(tokens ?? {}) } },
  };
}

function mapPreset(preset: StudioPreset): StudioPreset {
  return {
    ...preset,
    config: withResolvedTokens(preset.config),
    modes: preset.modes
      ? Object.fromEntries(
          Object.entries(preset.modes).map(([mode, config]) => [mode, withResolvedTokens(config)]),
        )
      : undefined,
  };
}

export function presetConfigForMode(preset: StudioPreset, mode: StudioThemeMode): NajmDesignConfig {
  const explicit = preset.modes?.[mode];
  if (explicit) return explicit;
  if ((preset.config.theme.mode ?? "light") === mode) return preset.config;

  return withResolvedTokens({
    ...preset.config,
    theme: {
      ...preset.config.theme,
      mode,
      tokens: composePreset(mode, preset.config.theme.accent ?? "neutral"),
    },
  });
}

const baseTypography: NajmDesignConfig["typography"] = {
  fontSans: "Geist, ui-sans-serif, system-ui, sans-serif",
  fontHeading: "Geist, ui-sans-serif, system-ui, sans-serif",
  fontMono: "JetBrains Mono, ui-monospace, monospace",
  baseSize: "14px",
  scale: "default",
  lineHeight: "1.5",
  letterSpacing: "0",
};

const smsTypography: NajmDesignConfig["typography"] = {
  fontSans: "Libre Baskerville, serif",
  fontHeading: "Lora, serif",
  fontMono: "IBM Plex Mono, monospace",
  baseSize: "14px",
  scale: "default",
  lineHeight: "1.5",
  letterSpacing: "0",
};

const smsLightTokens = {
  background: "oklch(94.827% 0.00756 260.887)",
  foreground: "oklch(0.2686 0 0)",
  card: "oklch(1.0000 0 0)",
  "card-foreground": "oklch(0.2686 0 0)",
  popover: "oklch(1.0000 0 0)",
  "popover-foreground": "oklch(0.2686 0 0)",
  primary: "oklch(0.5227 0.1920 9.5005)",
  "primary-foreground": "oklch(0.9461 0 0)",
  secondary: "oklch(0.7686 0.1647 70.0804)",
  "secondary-foreground": "oklch(0.9851 0 0)",
  tertiary: "oklch(0.4282 0.1199 251.76)",
  "tertiary-foreground": "oklch(1.0000 0 0)",
  muted: "oklch(0.9846 0.0017 247.8389)",
  "muted-foreground": "oklch(45.605% 0.01402 264.46)",
  accent: "oklch(0.9869 0.0214 95.2774)",
  "accent-foreground": "oklch(0.4732 0.1247 46.2007)",
  destructive: "oklch(0.6368 0.2078 25.3313)",
  "destructive-foreground": "oklch(1.0000 0 0)",
  border: "oklch(0.9276 0.0058 264.5313)",
  input: "oklch(0.9276 0.0058 264.5313)",
  ring: "oklch(0.7686 0.1647 70.0804)",
  "chart-1": "oklch(0.7686 0.1647 70.0804)",
  "chart-2": "oklch(0.6658 0.1574 58.3183)",
  "chart-3": "oklch(0.5553 0.1455 48.9975)",
  "chart-4": "oklch(0.4732 0.1247 46.2007)",
  "chart-5": "oklch(0.4137 0.1054 45.9038)",
  sidebar: "oklch(30.309% 0.03847 275.569)",
  "sidebar-foreground": "oklch(23.106% 0.05801 273.883)",
  "sidebar-primary": "oklch(0.7686 0.1647 70.0804)",
  "sidebar-primary-foreground": "oklch(1.0000 0 0)",
  "sidebar-accent": "oklch(0.9869 0.0214 95.2774)",
  "sidebar-accent-foreground": "oklch(0.4732 0.1247 46.2007)",
  "sidebar-border": "oklch(0.9276 0.0058 264.5313)",
  "sidebar-ring": "oklch(0.7686 0.1647 70.0804)",
};

const smsDarkTokens = {
  background: "oklch(0.2046 0 0)",
  foreground: "oklch(0.9219 0 0)",
  card: "oklch(0.2686 0 0)",
  "card-foreground": "oklch(0.9219 0 0)",
  popover: "oklch(0.2686 0 0)",
  "popover-foreground": "oklch(0.9219 0 0)",
  primary: "oklch(59.957% 0.23894 15.843)",
  "primary-foreground": "oklch(0 0 0)",
  secondary: "oklch(0.8125 0.1634 85.4964)",
  "secondary-foreground": "oklch(0.9219 0 0)",
  tertiary: "oklch(0.6500 0.1350 251.76)",
  "tertiary-foreground": "oklch(0.1000 0 0)",
  muted: "oklch(0.2393 0 0)",
  "muted-foreground": "oklch(0.7155 0 0)",
  accent: "oklch(0.4732 0.1247 46.2007)",
  "accent-foreground": "oklch(0.9243 0.1151 95.7459)",
  destructive: "oklch(0.6368 0.2078 25.3313)",
  "destructive-foreground": "oklch(1.0000 0 0)",
  border: "oklch(0.3715 0 0)",
  input: "oklch(0.3715 0 0)",
  ring: "oklch(0.7686 0.1647 70.0804)",
  "chart-1": "oklch(0.8369 0.1644 84.4286)",
  "chart-2": "oklch(0.6658 0.1574 58.3183)",
  "chart-3": "oklch(0.4732 0.1247 46.2007)",
  "chart-4": "oklch(0.5553 0.1455 48.9975)",
  "chart-5": "oklch(0.4732 0.1247 46.2007)",
  sidebar: "oklch(21.821% 0.07 271.185)",
  "sidebar-foreground": "oklch(0.9219 0 0)",
  "sidebar-primary": "oklch(0.7686 0.1647 70.0804)",
  "sidebar-primary-foreground": "oklch(1.0000 0 0)",
  "sidebar-accent": "oklch(0.4732 0.1247 46.2007)",
  "sidebar-accent-foreground": "oklch(0.9243 0.1151 95.7459)",
  "sidebar-border": "oklch(0.3715 0 0)",
  "sidebar-ring": "oklch(0.7686 0.1647 70.0804)",
};

export const SMS_DASHBOARD_PRESET_ID = "sms-dashboard";

const RAW_PRESETS: StudioPreset[] = [
  {
    id: "najm-default",
    name: "Najm Default",
    config: {
      version: 1,
      theme: { mode: "light", accent: "neutral", radius: "0.625rem", radiusScale: "shadcn" },
      typography: baseTypography,
      components: {},
    },
  },
  {
    id: "neutral-shadcn",
    name: "Shadcn Neutral",
    config: {
      version: 1,
      theme: { mode: "light", accent: "neutral", radius: "0.5rem", radiusScale: "shadcn" },
      typography: baseTypography,
    },
  },
  {
    id: "violet-dark",
    name: "Violet Dark",
    config: {
      version: 1,
      theme: {
        mode: "dark",
        accent: "violet",
        radius: "0.75rem",
        radiusScale: "uniform",
        tokens: { primary: "oklch(0.62 0.24 292)" },
      },
      typography: baseTypography,
      components: {
        button: { radius: "md" },
        card: { radius: "xl" },
        badge: { radius: "full", variants: { default: { use: "secondary" } } },
      },
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    config: {
      version: 1,
      theme: { mode: "dark", accent: "emerald", radius: "0.625rem" },
      typography: baseTypography,
    },
  },
  {
    id: "ocean-blue",
    name: "Dashboard Blue",
    config: {
      version: 1,
      theme: { mode: "light", accent: "blue", radius: "0.5rem" },
      typography: baseTypography,
      components: { card: { radius: "lg" }, button: { radius: "sm" } },
    },
  },
  {
    id: "sms-dashboard",
    name: "SMS Dashboard",
    config: {
      version: 1,
      theme: {
        mode: "light",
        accent: "neutral",
        radius: "0.375rem",
        radiusScale: "shadcn",
        spacing: "0.25rem",
        tokens: smsLightTokens,
      },
      typography: smsTypography,
      components: {
        badge: { radius: "full" },
        button: { radius: "md" },
        card: { radius: "lg" },
        input: { radius: "md" },
        select: { radius: "md" },
        table: { density: "compact" },
        tabs: { radius: "md" },
      },
      layout: { pageGutter: "24px", sectionGap: "20px" },
    },
    modes: {
      dark: {
        version: 1,
        theme: {
          mode: "dark",
          accent: "neutral",
          radius: "0.375rem",
          radiusScale: "shadcn",
          spacing: "0.25rem",
          tokens: smsDarkTokens,
        },
        typography: smsTypography,
        components: {
          badge: { radius: "full" },
          button: { radius: "md" },
          card: { radius: "lg" },
          input: { radius: "md" },
          select: { radius: "md" },
          table: { density: "compact" },
          tabs: { radius: "md" },
        },
        layout: { pageGutter: "24px", sectionGap: "20px" },
      },
    },
  },
  {
    id: "slate-pro",
    name: "Warm Professional",
    config: {
      version: 1,
      theme: { mode: "dark", accent: "slate", radius: "0.5rem" },
      typography: { ...baseTypography, fontSans: "Inter, ui-sans-serif, system-ui, sans-serif" },
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    config: {
      version: 1,
      theme: {
        mode: "dark",
        accent: "neutral",
        radius: "0.25rem",
        appearance: { borderWidth: "2px" },
        tokens: {
          background: "oklch(0 0 0)",
          foreground: "oklch(1 0 0)",
          primary: "oklch(1 0 0)",
          "primary-foreground": "oklch(0 0 0)",
        },
      },
      typography: baseTypography,
    },
  },
];

export const PRESETS: StudioPreset[] = RAW_PRESETS.map(mapPreset);

export const DEFAULT_PRESET = PRESETS.find((preset) => preset.id === SMS_DASHBOARD_PRESET_ID) ?? PRESETS[0];
