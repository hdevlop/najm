import React from 'react';

export interface NextLinkAdapterProps extends Record<string, any> {
  href: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export function NextLinkAdapter({ children, ...props }: NextLinkAdapterProps) {
  return React.createElement('a', props, children);
}

export function useNextNavigationAdapter() {
  return {
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    push: (path: string) => {
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', path);
      }
    },
    replace: (path: string) => {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', path);
      }
    },
  };
}
