import { Alert, AlertIcon } from 'najm-ui';
import { X } from 'lucide-react';
import type { BannerMessage } from '../types';

interface SemanticBannerProps {
  banner: BannerMessage | null;
  onDismiss: () => void;
}

export function SemanticBanner({ banner, onDismiss }: SemanticBannerProps) {
  if (!banner) return null;
  return (
    <Alert
      variant={banner.kind === 'error' ? 'destructive' : banner.kind === 'warning' ? 'warning' : 'default'}
      role="alert"
      aria-live={banner.kind === 'error' ? 'assertive' : 'polite'}
    >
      <AlertIcon variant={banner.kind === 'error' ? 'destructive' : banner.kind === 'warning' ? 'warning' : 'default'} />
      <span className="flex-1">{banner.message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </Alert>
  );
}