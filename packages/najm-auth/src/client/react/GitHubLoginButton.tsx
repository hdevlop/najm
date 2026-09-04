import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { OAuthLoginOptions } from '../types';
import { useGitHubLogin } from './useGitHubLogin';

interface GitHubLoginButtonProps extends OAuthLoginOptions {
  children: ReactNode;
  onError?: (error: Error) => void;
}

export function GitHubLoginButton({ children, returnTo, onError }: GitHubLoginButtonProps) {
  const { loginWithGitHub, isRedirecting } = useGitHubLogin({ onError });
  const child = Children.only(children);
  if (!isValidElement(child)) {
    throw new Error('<GitHubLoginButton> expects a single React element as its child');
  }

  const element = child as ReactElement<{
    onClick?: (event: unknown) => void;
    disabled?: boolean;
  }>;

  return cloneElement(element, {
    onClick: (event: unknown) => {
      element.props.onClick?.(event);
      if (!(event as { defaultPrevented?: boolean })?.defaultPrevented) {
        loginWithGitHub({ returnTo });
      }
    },
    disabled: Boolean(element.props.disabled || isRedirecting),
  });
}
