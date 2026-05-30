import { toast } from 'sonner';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastApi {
  show: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export function useToast(): ToastApi {
  return {
    show: (kind, message) => {
      if (kind === 'success') toast.success(message);
      else if (kind === 'error') toast.error(message);
      else toast(message);
    },
    success: (message) => toast.success(message),
    error: (message) => toast.error(message),
    info: (message) => toast(message),
  };
}
