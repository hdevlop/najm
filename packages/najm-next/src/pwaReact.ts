'use client';

import { useEffect } from 'react';

export interface NajmPwaRegistrationProps {
  enabled?: boolean;
  scope?: string;
  scriptUrl?: string;
}

export function NajmPwaRegistration({
  enabled = true,
  scope = '/',
  scriptUrl = '/sw.js',
}: NajmPwaRegistrationProps = {}) {
  useEffect(() => {
    if (!enabled || process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    const register = () => {
      void navigator.serviceWorker
        .register(scriptUrl, { scope, updateViaCache: 'none' })
        .catch(() => undefined);
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, [enabled, scope, scriptUrl]);

  return null;
}
