import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { useLogout } from './useLogout';

interface SignOutButtonProps {
  /** A single clickable child element. Its `onClick` will be wired to logout. */
  children: ReactNode;
  /** Called after logout succeeds */
  onSuccess?: () => void;
  /** Called if logout throws */
  onError?: (error: Error) => void;
}

/**
 * Wires a child element's `onClick` to the logout flow.
 * Headless — bring your own button. The child can be any clickable element.
 *
 * @example
 * ```tsx
 * <SignOutButton onSuccess={() => router.replace('/login')}>
 *   <button>Sign out</button>
 * </SignOutButton>
 *
 * <SignOutButton>
 *   <Button variant="destructive">Logout</Button>
 * </SignOutButton>
 * ```
 */
export function SignOutButton({ children, onSuccess, onError }: SignOutButtonProps) {
  const { logout, isLoading } = useLogout({ onSuccess, onError });

  const child = Children.only(children);
  if (!isValidElement(child)) {
    throw new Error('<SignOutButton> expects a single React element as its child');
  }

  const element = child as ReactElement<{
    onClick?: (e: unknown) => void;
    disabled?: boolean;
  }>;

  return cloneElement(element, {
    onClick: () => logout(),
    disabled: element.props.disabled ?? isLoading,
  });
}
