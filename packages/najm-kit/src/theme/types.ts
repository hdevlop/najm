export type NajmMode = 'light' | 'dark';
export type NajmAccent = 'neutral' | 'emerald' | 'green' | 'slate' | 'blue' | 'violet';
export type NajmPreset =
  | 'light'
  | 'dark'
  | 'dark-emerald'
  | 'dark-green'
  | 'dark-slate'
  | 'dark-blue'
  | 'dark-violet';

export interface NajmAppearance {
  /** Global border thickness, e.g. `'0'`, `'1px'`, `'2px'`. `'0'` hides borders. */
  borderWidth?: string;
}

export interface NajmThemeTokens {
  background?: string;
  foreground?: string;
  card?: string;
  'card-foreground'?: string;
  popover?: string;
  'popover-foreground'?: string;
  primary?: string;
  'primary-foreground'?: string;
  secondary?: string;
  'secondary-foreground'?: string;
  tertiary?: string;
  'tertiary-foreground'?: string;
  muted?: string;
  'muted-foreground'?: string;
  accent?: string;
  'accent-foreground'?: string;
  destructive?: string;
  'destructive-foreground'?: string;
  border?: string;
  input?: string;
  ring?: string;
  sidebar?: string;
  'sidebar-foreground'?: string;
  'sidebar-primary'?: string;
  'sidebar-primary-foreground'?: string;
  'sidebar-accent'?: string;
  'sidebar-accent-foreground'?: string;
  'sidebar-border'?: string;
  'sidebar-ring'?: string;
  'chart-1'?: string;
  'chart-2'?: string;
  'chart-3'?: string;
  'chart-4'?: string;
  'chart-5'?: string;
  radius?: string;
}

/** Serializable theme settings suitable for JSON files, APIs, or local storage. */
export interface NajmThemeConfig {
  preset?: NajmPreset;
  mode?: NajmMode;
  accent?: NajmAccent;
  tokens?: NajmThemeTokens;
  /**
   * Per-mode token overrides authored on top of the composed preset. Keeps
   * light and dark customizations independent: editing a token in one mode
   * records it here so it survives switching to the other mode and back.
   * Providers resolve this field on top of the composed mode/accent preset.
   */
  overrides?: Partial<Record<NajmMode, NajmThemeTokens>>;
  accentOnly?: boolean;
  appearance?: NajmAppearance;
  radius?: string;
}

export interface NajmThemeProviderProps {
  /** Serializable theme settings. Explicit provider props override this config. */
  config?: NajmThemeConfig;
  preset?: NajmPreset;
  mode?: NajmMode;
  accent?: NajmAccent;
  tokens?: NajmThemeTokens;
  /** When true, only inject accent tokens (primary, ring, accent and their foregrounds).
   *  Everything else (bg, card, fg…) is inherited from the parent cascade. */
  accentOnly?: boolean;
  /** App-wide UI preferences (currently global border width). */
  appearance?: NajmAppearance;
  /** Global base radius, for example `0`, `0.5rem`, or `0.75rem`. */
  radius?: string;
  className?: string;
  asChild?: boolean;
  children: React.ReactNode;
}
