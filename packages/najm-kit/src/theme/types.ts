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

export type NajmRadiusScale = 'shadcn' | 'uniform';

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
   * The provider ignores this field — consumers compose `tokens` from it.
   */
  overrides?: Partial<Record<NajmMode, NajmThemeTokens>>;
  accentOnly?: boolean;
  appearance?: NajmAppearance;
  radius?: string;
  radiusScale?: NajmRadiusScale;
  /**
   * Global spacing base that scales every spacing utility (padding, gap,
   * margin, sizing) in the subtree. Maps to Tailwind v4's `--spacing` token,
   * for example `'0.25rem'` (default), `'0.2rem'` (compact), `'0.3rem'`
   * (comfortable). Acts as a single density dial for the whole UI.
   */
  spacing?: string;
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
  /**
   * `shadcn` keeps the standard sm/md/lg offsets around the base radius.
   * `uniform` makes every non-pill radius utility use the same value.
   */
  radiusScale?: NajmRadiusScale;
  /** Global spacing base mapped to Tailwind's `--spacing` token. Scales all
   *  padding/gap/margin/sizing utilities in the subtree (density dial). */
  spacing?: string;
  className?: string;
  asChild?: boolean;
  children: React.ReactNode;
}
