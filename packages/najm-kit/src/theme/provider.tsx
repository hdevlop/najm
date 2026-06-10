import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import type {
  NajmAppearance,
  NajmThemeProviderProps,
  NajmThemeTokens,
} from './types';
import { composePreset, resolvePreset } from './presets/compose';

const ACCENT_KEYS = new Set(['primary', 'primary-foreground', 'ring', 'accent', 'accent-foreground']);

function tokensToStyle(tokens: NajmThemeTokens, accentOnly?: boolean): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (value && (!accentOnly || ACCENT_KEYS.has(key))) {
      style[`--najm-${key}`] = value;
    }
  }
  return style as React.CSSProperties;
}

// Tracks whether a parent NajmThemeProvider already exists in the tree.
// Only the outermost provider syncs its vars to :root so that Radix portals
// (Select, Popover, etc.) rendered outside the themed div inherit the theme.
const NajmThemeDepthContext = React.createContext(0);

// Provides the nearest NajmThemeProvider div element so Radix portals
// can render inside it and inherit the scoped CSS variables.
export const NajmThemeContainerCtx = React.createContext<HTMLElement | null>(null);

export const DEFAULT_APPEARANCE: Required<NajmAppearance> = {
  borderDegree: 'default',
};

const NajmAppearanceContext = React.createContext<Required<NajmAppearance>>(DEFAULT_APPEARANCE);

export function useNajmAppearance(): Required<NajmAppearance> {
  return React.useContext(NajmAppearanceContext);
}

export function NajmThemeProvider({
  preset,
  mode,
  accent,
  tokens,
  accentOnly,
  appearance,
  className,
  asChild,
  children,
}: NajmThemeProviderProps) {
  const depth = React.useContext(NajmThemeDepthContext);
  const isRoot = depth === 0;
  const parentAppearance = React.useContext(NajmAppearanceContext);

  const shouldApplyThemeTokens = isRoot || Boolean(preset || mode || tokens);

  const resolved: NajmThemeTokens | null = React.useMemo(() => {
    if (!shouldApplyThemeTokens) return null;
    if (tokens) return tokens;
    if (preset) return resolvePreset(preset);
    if (mode) return composePreset(mode, accent ?? 'neutral');
    return resolvePreset('light');
  }, [preset, mode, accent, tokens, shouldApplyThemeTokens]);

  const style = React.useMemo(() => resolved ? tokensToStyle(resolved, accentOnly) : undefined, [resolved, accentOnly]);
  const Comp: any = asChild ? Slot : 'div';
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  const resolvedAppearance = React.useMemo<Required<NajmAppearance>>(
    () => ({ ...parentAppearance, ...(appearance ?? {}) }),
    [parentAppearance, appearance]
  );

  // Mirror the active theme vars to :root so Radix portal content (dropdowns,
  // popovers) inherits the correct CSS variables instead of the :root defaults.
  React.useEffect(() => {
    if (!isRoot) return;
    const root = document.documentElement;
    const entries = Object.entries(style ?? {}) as [string, string][];
    entries.forEach(([k, v]) => root.style.setProperty(k, v));
    return () => entries.forEach(([k]) => root.style.removeProperty(k));
  }, [style, isRoot]);

  return (
    <NajmThemeDepthContext.Provider value={depth + 1}>
      <NajmAppearanceContext.Provider value={resolvedAppearance}>
        <NajmThemeContainerCtx.Provider value={container}>
          <Comp
            ref={setContainer}
            data-najm-theme={preset ?? `${mode ?? 'light'}-${accent ?? 'neutral'}`}
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
