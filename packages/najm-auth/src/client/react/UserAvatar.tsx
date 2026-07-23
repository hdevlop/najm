import type { CSSProperties } from 'react';
import { useUser } from './useUser';

interface UserAvatarProps {
  /** Pixel size of the avatar (default: 32) */
  size?: number;
  /** Override CSS class — replaces default styles */
  className?: string;
  /** Inline style overrides — merged with default styles */
  style?: CSSProperties;
  /** Alt text (default: user name/email) */
  alt?: string;
}

/**
 * Renders the user's avatar.
 * - If `user.avatar` (or `user.image`/`user.picture`) is set → renders an `<img>`.
 * - Otherwise → renders a circular initial badge from name/email.
 *
 * Default style is a rounded circle with a neutral background.
 * Pass `className` to fully replace styling, or `style` to merge.
 *
 * @example
 * ```tsx
 * <UserAvatar size={48} />
 * <UserAvatar className="my-avatar" />
 * ```
 */
export function UserAvatar({ size = 32, className, style, alt }: UserAvatarProps) {
  const user = useUser();

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '9999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    color: '#475569',
    fontWeight: 600,
    fontSize: Math.round(size * 0.4),
    overflow: 'hidden',
    flexShrink: 0,
    ...style,
  };

  const src =
    (user?.avatar as string | undefined) ??
    (user?.image as string | undefined) ??
    (user?.picture as string | undefined) ??
    null;

  const label = (user?.name as string | undefined) ?? user?.email ?? '';
  const initial = label ? label[0]!.toUpperCase() : '?';
  const altText = alt ?? label ?? 'User avatar';

  if (src) {
    return (
      <img
        src={src}
        alt={altText}
        width={size}
        height={size}
        className={className}
        style={className ? undefined : baseStyle}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={altText}
      className={className}
      style={className ? undefined : baseStyle}
    >
      {initial}
    </span>
  );
}
