import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import type {
  NajmAppearance,
  NajmMode,
  NajmThemeConfig,
  NajmThemeProviderProps,
  NajmThemeTokens,
} from './types';
import { composePreset, resolvePreset } from './presets/compose';

const ACCENT_KEYS = new Set([
  'primary',
  'primary-foreground',
  'ring',
  'accent',
  'accent-foreground',
  'sidebar-primary',
  'sidebar-ring',
]);

function tokensToStyle(tokens: NajmThemeTokens, accentOnly?: boolean): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (value && (!accentOnly || ACCENT_KEYS.has(key))) {
      style[`--${key}`] = value;
    }
  }
  return style as React.CSSProperties;
}

const RADIUS_TOKENS = [
  '--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl',
  '--radius-2xl', '--radius-3xl', '--radius-4xl',
] as const;

function radiusToStyle(radius: string): React.CSSProperties {
  const style: Record<string, string> = { '--radius': radius };

  for (const key of RADIUS_TOKENS) style[key] = 'var(--radius)';

  return style as React.CSSProperties;
}

function resolveThemeTokens({
  preset,
  mode,
  accent,
  explicitTokens,
  configTokens,
  configMode,
  overrides,
}: {
  preset: NajmThemeProviderProps['preset'] | undefined;
  mode: NajmMode | undefined;
  accent: NajmThemeProviderProps['accent'] | undefined;
  explicitTokens: NajmThemeTokens | undefined;
  configTokens: NajmThemeTokens | undefined;
  configMode: NajmMode | undefined;
  overrides: NajmThemeConfig['overrides'];
}): NajmThemeTokens | null {
  if (explicitTokens) return explicitTokens;

  const tokenMode = mode ?? configMode;
  const modeOverrides = tokenMode ? overrides?.[tokenMode] : undefined;
  const tokensMatchMode = !configMode || !tokenMode || configMode === tokenMode;
  const scopedTokens = tokensMatchMode ? configTokens : undefined;

  if (preset) {
    return { ...resolvePreset(preset), ...(scopedTokens ?? {}), ...(modeOverrides ?? {}) };
  }

  if (tokenMode) {
    return {
      ...composePreset(tokenMode, accent ?? 'neutral'),
      ...(scopedTokens ?? {}),
      ...(modeOverrides ?? {}),
    };
  }

  if (scopedTokens || modeOverrides) return { ...(scopedTokens ?? {}), ...(modeOverrides ?? {}) };
  return null;
}

// Tracks whether a parent NajmThemeProvider already exists in the tree.
// Used so the depth context still flows through nested providers for
// appearance/context propagation; with root mirroring removed, the depth
// value is informational only.
const NajmThemeDepthContext = React.createContext(0);

const NajmThemeModeContext = React.createContext<NajmMode | undefined>(undefined);

/** Returns the active mode inherited from the nearest Najm theme provider. */
export function useNajmThemeMode(): NajmMode | undefined {
  return React.useContext(NajmThemeModeContext);
}

// Provides the nearest NajmThemeProvider div element so Radix portals
// can render inside it and inherit the scoped CSS variables.
export const NajmThemeContainerCtx = React.createContext<HTMLElement | null>(null);

export const DEFAULT_APPEARANCE: NajmAppearance = {};

const NajmAppearanceContext = React.createContext<NajmAppearance>(DEFAULT_APPEARANCE);

export function useNajmAppearance(): NajmAppearance {
  return React.useContext(NajmAppearanceContext);
}

export function NajmThemeProvider({
  config,
  preset,
  mode,
  accent,
  tokens,
  accentOnly,
  appearance,
  radius,
  className,
  asChild,
  children,
}: NajmThemeProviderProps) {
  const depth = React.useContext(NajmThemeDepthContext);
  const parentMode = React.useContext(NajmThemeModeContext);
  const parentAppearance = React.useContext(NajmAppearanceContext);
  const effectivePreset = preset ?? config?.preset;
  const effectiveMode = mode ?? config?.mode;
  const effectiveAccent = accent ?? config?.accent;
  const effectiveAccentOnly = accentOnly ?? config?.accentOnly;
  const effectiveRadius = radius ?? config?.radius;
  const effectiveBorderWidth = appearance?.borderWidth ?? config?.appearance?.borderWidth;

  const resolved: NajmThemeTokens | null = React.useMemo(() => {
    return resolveThemeTokens({
      preset: effectivePreset,
      mode: effectiveMode,
      accent: effectiveAccent,
      explicitTokens: tokens,
      configTokens: config?.tokens,
      configMode: config?.mode,
      overrides: config?.overrides,
    });
  }, [
    effectivePreset,
    effectiveMode,
    effectiveAccent,
    tokens,
    config?.tokens,
    config?.mode,
    config?.overrides,
  ]);

  const style = React.useMemo(
    () => {
      const tokenStyle = resolved ? tokensToStyle(resolved, effectiveAccentOnly) : undefined;
      const radiusStyle = effectiveRadius !== undefined
        ? radiusToStyle(effectiveRadius)
        : undefined;
      const borderWidthStyle = effectiveBorderWidth !== undefined
        ? { '--border-width': effectiveBorderWidth } as React.CSSProperties
        : undefined;
      if (!tokenStyle && !radiusStyle && !borderWidthStyle) return undefined;
      return { ...tokenStyle, ...radiusStyle, ...borderWidthStyle } as React.CSSProperties;
    },
    [resolved, effectiveAccentOnly, effectiveRadius, effectiveBorderWidth],
  );
  const Comp: any = asChild ? Slot : 'div';
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLElement | null>(null);
  const handleContainerRef = React.useCallback((node: HTMLElement | null) => {
    if (containerRef.current === node) return;
    containerRef.current = node;
    setContainer(node);
  }, []);

  const resolvedAppearance = React.useMemo<NajmAppearance>(
    () => ({ ...parentAppearance, ...(config?.appearance ?? {}), ...(appearance ?? {}) }),
    [parentAppearance, config?.appearance, appearance],
  );

  return (
    <NajmThemeDepthContext.Provider value={depth + 1}>
      <NajmThemeModeContext.Provider value={effectiveMode ?? parentMode}>
        <NajmAppearanceContext.Provider value={resolvedAppearance}>
          <NajmThemeContainerCtx.Provider value={container}>
            <Comp
              ref={handleContainerRef}
              suppressHydrationWarning
              data-najm-theme={effectivePreset ?? `${effectiveMode ?? 'light'}-${effectiveAccent ?? 'neutral'}`}
              className={className}
              style={style}
            >
              {children}
            </Comp>
          </NajmThemeContainerCtx.Provider>
        </NajmAppearanceContext.Provider>
      </NajmThemeModeContext.Provider>
    </NajmThemeDepthContext.Provider>
  );
}
