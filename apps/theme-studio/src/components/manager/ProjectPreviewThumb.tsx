import type { ThemeStyle } from '@/app/theme-studio-api';

const SWATCH_KEYS = ['background', 'card', 'primary', 'accent', 'destructive', 'border'] as const;

export function ProjectPreviewThumb({ style }: { style?: ThemeStyle }) {
  const tokens = (style?.config.theme.tokens ?? {}) as Record<string, string>;

  return (
    <div
      className="relative flex h-28 w-full items-end gap-1 overflow-hidden rounded-lg border border-border p-2 shadow-inner"
      style={{ background: tokens.background ?? 'var(--muted)' }}
    >
      <div
        className="absolute left-3 top-3 h-8 w-16 rounded-md border border-black/10"
        style={{ background: tokens.card ?? 'var(--card)' }}
      />
      <div
        className="absolute right-3 top-3 h-2 w-16 rounded-full"
        style={{ background: tokens.primary ?? 'var(--primary)' }}
      />
      {SWATCH_KEYS.map((key) => (
        <span
          key={key}
          title={key}
          className="h-7 flex-1 rounded-sm border border-black/10"
          style={{ background: tokens[key] ?? 'transparent' }}
        />
      ))}
    </div>
  );
}
