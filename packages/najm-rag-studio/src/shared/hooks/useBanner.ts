import { useState, useCallback, useEffect } from 'react';

export type BannerKind = 'info' | 'success' | 'warning' | 'error';

export interface Banner {
  kind: BannerKind;
  message: string;
}

export function useBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);

  const showBanner = useCallback((kind: BannerKind, message: string) => {
    setBanner({ kind, message });
  }, []);

  const dismissBanner = useCallback(() => {
    setBanner(null);
  }, []);

  useEffect(() => {
    if (banner?.kind === 'info' || banner?.kind === 'success') {
      const timer = setTimeout(dismissBanner, 5000);
      return () => clearTimeout(timer);
    }
  }, [banner, dismissBanner]);

  return { banner, showBanner, dismissBanner };
}
