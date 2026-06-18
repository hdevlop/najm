import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import type {
  NajmAppearance,
  NajmRadiusScale,
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
  const effectiveTokens = tokens ?? config?.tokens;
  const effectiveAccentOnly = accentOnly ?? config?.accentOnly;
  const effectiveRadius = radius ?? config?.radius;
  const effectiveRadiusScale = radiusScale ?? config?.radiusScale ?? 'shadcn';
  const effectiveSpacing = spacing ?? config?.spacing;
  const effectiveBorderWidth = appearance?.borderWidth ?? config?.appearance?.borderWidth;

  // Opt-in: only inject token style when the caller or JSON config overrides
  // the cascade. A bare provider is a no-op so :root/.dark owns theming.
  const shouldApplyThemeTokens = Boolean(effectivePreset || effectiveMode || effectiveTokens);

  const resolved: NajmThemeTokens | null = React.useMemo(() => {
    if (!shouldApplyThemeTokens) return null;
    if (effectiveTokens) return effectiveTokens;
    if (effectivePreset) return resolvePreset(effectivePreset);
    return composePreset(effectiveMode!, effectiveAccent ?? 'neutral');
  }, [effectivePreset, effectiveMode, effectiveAccent, effectiveTokens, shouldApplyThemeTokens]);

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

  const resolvedAppearance = React.useMemo<NajmAppearance>(
    () => ({ ...parentAppearance, ...(config?.appearance ?? {}), ...(appearance ?? {}) }),
    [parentAppearance, config?.appearance, appearance],
  );

  return (
    <NajmThemeDepthContext.Provider value={depth + 1}>
      <NajmAppearanceContext.Provider value={resolvedAppearance}>
        <NajmThemeContainerCtx.Provider value={container}>
          <Comp
            ref={setContainer}
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
