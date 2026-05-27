import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

interface LoginButtonProps {
  /** Where to navigate on click (default: '/login') */
  href?: string;
  children: ReactNode;
}

/**
 * Wires a child element's onClick to navigate to the login page.
 * Headless — bring your own button.
 *
 * @example
 * ```tsx
 * <SignedOut>
 *   <LoginButton href="/login">
 *     <Button>Sign in</Button>
 *   </LoginButton>
 * </SignedOut>
 * ```
 */
export function LoginButton({ href = '/login', children }: LoginButtonProps) {
  const child = Children.only(children);
  if (!isValidElement(child)) {
    throw new Error('<LoginButton> expects a single React element as its child');
  }

  const element = child as ReactElement<{ onClick?: (e: unknown) => void }>;

  return cloneElement(element, {
    onClick: () => {
      if (typeof window !== 'undefined') {
        window.location.href = href;
      }
    },
  });
}
