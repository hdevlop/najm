import { useUser } from './useUser';

interface UserNameProps {
  /** Optional fallback shown when no user is loaded */
  fallback?: string;
}

/**
 * Renders the user's display name as plain text.
 * Falls back to email, then to the `fallback` prop, then to empty string.
 *
 * @example
 * ```tsx
 * <span>Hi, <UserName fallback="guest" />!</span>
 * ```
 */
export function UserName({ fallback = '' }: UserNameProps) {
  const user = useUser();
  if (!user) return <>{fallback}</>;
  const name = (user.name as string | undefined) ?? user.email ?? fallback;
  return <>{name}</>;
}
