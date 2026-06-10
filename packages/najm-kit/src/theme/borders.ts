import { useNajmAppearance } from './provider';
import type { NajmBorderDegree } from './types';

export interface BorderResolutionOptions {
  borderDegree?: NajmBorderDegree;
  bordered?: boolean;
  fallback?: NajmBorderDegree;
}

export function resolveBorderDegree(
  borderDegree: NajmBorderDegree | undefined,
  bordered: boolean | undefined,
  globalBorderDegree: NajmBorderDegree | undefined,
  fallback: NajmBorderDegree = 'default',
): NajmBorderDegree {
  if (borderDegree) return borderDegree;
  if (bordered === true) return 'strong';
  if (bordered === false) return fallback;
  return globalBorderDegree ?? fallback;
}

export function borderColorClassForDegree(degree: NajmBorderDegree): string {
  switch (degree) {
    case 'none':
      return 'border-transparent';
    case 'subtle':
      return 'border-border-subtle';
    case 'strong':
      return 'border-border-strong';
    default:
      return 'border-border';
  }
}

export function inputBorderColorClassForDegree(degree: NajmBorderDegree): string {
  switch (degree) {
    case 'none':
      return 'border-transparent';
    case 'subtle':
      return 'border-border-subtle';
    case 'strong':
      return 'border-border-strong';
    default:
      return 'border-input';
  }
}

export function useResolvedBorderDegree(options: BorderResolutionOptions = {}): NajmBorderDegree {
  const appearance = useNajmAppearance();
  return resolveBorderDegree(
    options.borderDegree,
    options.bordered,
    appearance.borderDegree,
    options.fallback,
  );
}

export function surfaceBorderClasses(degree: NajmBorderDegree): string {
  if (degree === 'none') return 'border border-transparent';
  return `border ${borderColorClassForDegree(degree)}`;
}
