import { type LucideIcon, CheckCircle2, XCircle, Circle, ShieldCheck } from 'lucide-react';
import { badgeVariants } from 'najm-kit';
import type { VariantProps } from 'class-variance-authority';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

export type StatusType = 'pass' | 'fail' | 'low_confidence' | 'pending' | 'success' | 'error';
export type MatchLevel = 'primary' | 'secondary' | 'below_threshold';
export type ConfirmationLevel = 'danger' | 'warning' | 'notice' | null;

const variantMap: Record<StatusType, BadgeVariant> = {
  pass: 'success',
  success: 'success',
  fail: 'destructive',
  error: 'destructive',
  low_confidence: 'warning',
  pending: 'outline',
};

const labelMap: Record<StatusType, string> = {
  pass: 'Passed',
  success: 'Active',
  fail: 'Failed',
  error: 'Error',
  low_confidence: 'Low conf',
  pending: 'Pending',
};

const iconMap: Record<StatusType, LucideIcon> = {
  pass: CheckCircle2,
  success: CheckCircle2,
  fail: XCircle,
  error: XCircle,
  low_confidence: XCircle,
  pending: Circle,
};

export function statusToVariant(status: StatusType): BadgeVariant {
  return variantMap[status];
}

export function statusToLabel(status: StatusType): string {
  return labelMap[status];
}

export function statusToIcon(status: StatusType): LucideIcon {
  return iconMap[status];
}

export function matchLevelToVariant(level: MatchLevel): BadgeVariant {
  return level === 'primary' ? 'success' : level === 'secondary' ? 'warning' : 'outline';
}

export function confirmationToVariant(level: ConfirmationLevel): BadgeVariant {
  if (!level) return 'outline';
  return level === 'danger' ? 'destructive' : level === 'warning' ? 'warning' : 'outline';
}

export function confirmationToIcon(level: ConfirmationLevel): LucideIcon | null {
  if (!level) return null;
  return ShieldCheck;
}