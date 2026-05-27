import type { ReactNode } from 'react';
import { useSession } from './useSession';

interface SignedOutProps {
  children: ReactNode;
}

/**
 * Renders children only when the user is NOT authenticated.
 * Conditional render only — no redirects.
 *
 * @example
 * ```tsx
 * <SignedOut>
 *   <Link href="/login">Sign in</Link>
 * </SignedOut>
 * ```
 */
export function SignedOut({ children }: SignedOutProps) {
  const { status } = useSession();
  if (status !== 'unauthenticated') return null;
  return <>{children}</>;
}
