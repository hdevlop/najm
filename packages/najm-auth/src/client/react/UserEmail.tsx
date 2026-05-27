import { useUser } from './useUser';

interface UserEmailProps {
  fallback?: string;
}

/**
 * Renders the user's email as plain text.
 *
 * @example
 * ```tsx
 * <p>Email: <UserEmail fallback="Not available" /></p>
 * ```
 */
export function UserEmail({ fallback = '' }: UserEmailProps) {
  const user = useUser();
  return <>{user?.email ?? fallback}</>;
}
