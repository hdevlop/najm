import { NAlert } from 'najm-kit';
import { X } from 'lucide-react';
import type { Banner as BannerMessage } from '@/shared/hooks/useBanner';

interface SemanticBannerProps {
  banner: BannerMessage | null;
  onDismiss: () => void;
}

export function SemanticBanner({ banner, onDismiss }: SemanticBannerProps) {
  if (!banner) return null;
  return (
    <NAlert
      tone={banner.kind === 'error' ? 'destructive' : banner.kind === 'warning' ? 'warning' : 'default'}
      role="alert"
      aria-live={banner.kind === 'error' ? 'assertive' : 'polite'}
      description={banner.message}
      actions={
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      }
    />
  );
}
