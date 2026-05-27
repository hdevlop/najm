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
  radius?: string;
}

export interface NajmThemeProviderProps {
  preset?: NajmPreset;
  mode?: NajmMode;
  accent?: NajmAccent;
  tokens?: NajmThemeTokens;
  className?: string;
  asChild?: boolean;
  children: React.ReactNode;
}
