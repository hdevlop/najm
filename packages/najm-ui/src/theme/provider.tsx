import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import type { NajmThemeProviderProps, NajmThemeTokens } from './types';
import { composePreset, resolvePreset } from './presets/compose';

function tokensToStyle(tokens: NajmThemeTokens): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (value) style[`--${key}`] = value;
  }
  return style as React.CSSProperties;
}

export function NajmThemeProvider({
  preset,
  mode,
  accent,
  tokens,
  className,
  asChild,
  children,
}: NajmThemeProviderProps) {
  const resolved: NajmThemeTokens = React.useMemo(() => {
    if (tokens) return tokens;
    if (preset) return resolvePreset(preset);
    if (mode) return composePreset(mode, accent ?? 'neutral');
    return resolvePreset('light');
  }, [preset, mode, accent, tokens]);

  const style = React.useMemo(() => tokensToStyle(resolved), [resolved]);
  const Comp: any = asChild ? Slot : 'div';

  return (
    <Comp data-najm-theme={preset ?? `${mode ?? 'light'}-${accent ?? 'neutral'}`} className={className} style={style}>
      {children}
    </Comp>
  );
}
