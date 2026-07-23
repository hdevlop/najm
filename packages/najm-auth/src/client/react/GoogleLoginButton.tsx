import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { OAuthLoginOptions } from '../types';
import { useGoogleLogin } from './useGoogleLogin';

interface GoogleLoginButtonProps extends OAuthLoginOptions {
  children: ReactNode;
  onError?: (error: Error) => void;
}

export function GoogleLoginButton({ children, returnTo, onError }: GoogleLoginButtonProps) {
  const { loginWithGoogle, isRedirecting } = useGoogleLogin({ onError });
  const child = Children.only(children);
  if (!isValidElement(child)) {
    throw new Error('<GoogleLoginButton> expects a single React element as its child');
  }

  const element = child as ReactElement<{
    onClick?: (event: unknown) => void;
    disabled?: boolean;
  }>;

  return cloneElement(element, {
    onClick: (event: unknown) => {
      element.props.onClick?.(event);
      if (!(event as { defaultPrevented?: boolean })?.defaultPrevented) {
        loginWithGoogle({ returnTo });
      }
    },
    disabled: Boolean(element.props.disabled || isRedirecting),
  });
}
