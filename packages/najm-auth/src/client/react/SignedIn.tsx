import type { ReactNode } from 'react';
import { useSession } from './useSession';

interface SignedInProps {
  children: ReactNode;
}

/**
 * Renders children only when the user is authenticated.
 * Conditional render only — no redirects.
 *
 * @example
 * ```tsx
 * <SignedIn>
 *   <UserAvatar />
 *   <SignOutButton>Logout</SignOutButton>
 * </SignedIn>
 * ```
 */
export function SignedIn({ children }: SignedInProps) {
  const { status } = useSession();
  if (status !== 'authenticated') return null;
  return <>{children}</>;
}
