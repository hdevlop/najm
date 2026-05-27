import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from "../../lib/cn"

export type AlertVariant = 'default' | 'destructive' | 'warning' | 'success';

const variantClasses: Record<AlertVariant, string> = {
  default: 'border-border bg-card text-txt-secondary',
  destructive: 'border-status-red/35 bg-status-red/10 text-status-red',
  warning: 'border-status-yellow/35 bg-status-yellow/10 text-status-yellow',
  success: 'border-status-green/35 bg-status-green/10 text-status-green',
};

const variantIcons = {
  default: Info,
  destructive: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export function AlertIcon({ className, variant = 'default' }: { className?: string; variant?: AlertVariant }) {
  const Icon = variantIcons[variant];
  return <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', className)} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('font-medium', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('leading-5 opacity-80', className)} {...props} />;
}