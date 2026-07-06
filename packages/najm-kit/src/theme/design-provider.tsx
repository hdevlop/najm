import * as React from "react";
import { NajmThemeProvider } from "./provider";
import type {
  NajmComponentName,
  NajmComponentStyleConfig,
  NajmComponentThemeConfig,
  NajmDesignConfig,
  NajmLayoutConfig,
  NajmTypographyConfig,
} from "./design-types";
import type { NajmMode } from "./types";

interface NajmDesignContextValue {
  components: NajmComponentThemeConfig;
  typography?: NajmTypographyConfig;
  layout?: NajmLayoutConfig;
}

const NajmDesignContext = React.createContext<NajmDesignContextValue>({
  components: {},
});

export function useNajmDesign(): NajmDesignContextValue {
  return React.useContext(NajmDesignContext);
}

/** Returns the resolved component style recipe for a given component name. */
export function useNajmComponentStyle(
  name: NajmComponentName,
): NajmComponentStyleConfig | undefined {
  const { components } = useNajmDesign();
  return components[name];
}

const SCALE_FACTOR: Record<NonNullable<NajmTypographyConfig["scale"]>, string> = {
  compact: "0.95",
  default: "1",
  comfortable: "1.05",
};

function typographyToStyle(t: NajmTypographyConfig): React.CSSProperties {
  const style: Record<string, string> = {};
  if (t.fontSans) style["--font-sans"] = t.fontSans;
  if (t.fontHeading) style["--font-heading"] = t.fontHeading;
  if (t.fontMono) style["--font-mono"] = t.fontMono;
  if (t.baseSize) style["--font-size-base"] = t.baseSize;
  if (t.lineHeight) style["--line-height-base"] = t.lineHeight;
  if (t.letterSpacing) style["--letter-spacing-base"] = t.letterSpacing;
  if (t.scale) style["--font-scale"] = SCALE_FACTOR[t.scale];
  return style as React.CSSProperties;
}

function layoutToStyle(layout: NajmLayoutConfig): React.CSSProperties {
  const style: Record<string, string> = {};
  if (layout.pageGutter) style["--page-gutter"] = layout.pageGutter;
  if (layout.sectionGap) style["--section-gap"] = layout.sectionGap;
  return style as React.CSSProperties;
}

export interface NajmDesignProviderProps {
  config: NajmDesignConfig;
  mode?: NajmMode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Applies a full design config: wraps children in NajmThemeProvider for theme
 * tokens, applies typography CSS variables, and exposes component recipes via
 * context. NajmThemeProvider continues to work standalone for token-only needs.
 */
export function NajmDesignProvider({
  config,
  mode,
  className,
  children,
}: NajmDesignProviderProps) {
  const contextValue = React.useMemo<NajmDesignContextValue>(
    () => ({ components: config.components ?? {}, typography: config.typography, layout: config.layout }),
    [config.components, config.typography, config.layout],
  );

  const typographyStyle = React.useMemo(
    () => (config.typography ? typographyToStyle(config.typography) : undefined),
    [config.typography],
  );
  const layoutStyle = React.useMemo(
    () => (config.layout ? layoutToStyle(config.layout) : undefined),
    [config.layout],
  );
  const providerStyle = React.useMemo(
    () => ({ ...(layoutStyle ?? {}), ...(typographyStyle ?? {}) } as React.CSSProperties),
    [layoutStyle, typographyStyle],
  );

  return (
    <NajmDesignContext.Provider value={contextValue}>
      <NajmThemeProvider config={config.theme} mode={mode} className={className}>
        {layoutStyle || typographyStyle ? (
          // `display: contents` lets design CSS variables cascade to
          // children without introducing a layout box that would break height
          // chains (e.g. h-full) in the consuming app.
          <div style={{ display: "contents", ...providerStyle }} data-najm-design-vars="">
            {children}
          </div>
        ) : (
          children
        )}
      </NajmThemeProvider>
    </NajmDesignContext.Provider>
  );
}
