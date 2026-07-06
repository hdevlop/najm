import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import type {
  NajmAppearance,
  NajmMode,
  NajmRadiusScale,
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

const SHADCN_RADIUS_SCALE: Record<string, string> = {
  '--radius-xs': 'calc(var(--radius) - 4px)',
  '--radius-sm': 'calc(var(--radius) - 4px)',
  '--radius-md': 'calc(var(--radius) - 2px)',
  '--radius-lg': 'var(--radius)',
  '--radius-xl': 'calc(var(--radius) + 4px)',
  '--radius-2xl': 'calc(var(--radius) + 8px)',
  '--radius-3xl': 'calc(var(--radius) + 12px)',
  '--radius-4xl': 'calc(var(--radius) + 16px)',
};

function radiusToStyle(radius: string, scale: NajmRadiusScale): React.CSSProperties {
  const style: Record<string, string> = { '--radius': radius };

  for (const [key, value] of Object.entries(SHADCN_RADIUS_SCALE)) {
    style[key] = scale === 'uniform' ? 'var(--radius)' : value;
  }

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
  radiusScale,
  spacing,
  className,
  asChild,
  children,
}: NajmThemeProviderProps) {
  const depth = React.useContext(NajmThemeDepthContext);
  const parentAppearance = React.useContext(NajmAppearanceContext);
  const effectivePreset = preset ?? config?.preset;
  const effectiveMode = mode ?? config?.mode;
  const effectiveAccent = accent ?? config?.accent;
  const effectiveAccentOnly = accentOnly ?? config?.accentOnly;
  const effectiveRadius = radius ?? config?.radius;
  const effectiveRadiusScale = radiusScale ?? config?.radiusScale ?? 'shadcn';
  const effectiveSpacing = spacing ?? config?.spacing;
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
        ? radiusToStyle(effectiveRadius, effectiveRadiusScale)
        : undefined;
      const borderWidthStyle = effectiveBorderWidth !== undefined
        ? { '--border-width': effectiveBorderWidth } as React.CSSProperties
        : undefined;
      const spacingStyle = effectiveSpacing !== undefined
        ? { '--spacing': effectiveSpacing } as React.CSSProperties
        : undefined;

      if (!tokenStyle && !radiusStyle && !borderWidthStyle && !spacingStyle) return undefined;
      return { ...tokenStyle, ...radiusStyle, ...borderWidthStyle, ...spacingStyle } as React.CSSProperties;
    },
    [resolved, effectiveAccentOnly, effectiveRadius, effectiveRadiusScale, effectiveSpacing, effectiveBorderWidth],
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
    </NajmThemeDepthContext.Provider>
  );
}
