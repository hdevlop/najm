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

/**
 * Semantic border contrast preference. Components interpret this based on
 * their role (surface container, input, floating surface, etc.) so a single
 * app-wide value can drive border contrast for many components at once.
 */
export type NajmBorderDegree = 'none' | 'subtle' | 'default' | 'strong';

export interface NajmAppearance {
  borderDegree?: NajmBorderDegree;
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
  'border-subtle'?: string;
  'border-strong'?: string;
  input?: string;
  ring?: string;
  radius?: string;
}

export interface NajmThemeProviderProps {
  preset?: NajmPreset;
  mode?: NajmMode;
  accent?: NajmAccent;
  tokens?: NajmThemeTokens;
  /** When true, only inject accent tokens (primary, ring, accent and their foregrounds).
   *  Everything else (bg, card, fg…) is inherited from the parent cascade. */
  accentOnly?: boolean;
  /** App-wide UI preferences (currently border contrast). */
  appearance?: NajmAppearance;
  className?: string;
  asChild?: boolean;
  children: React.ReactNode;
}
