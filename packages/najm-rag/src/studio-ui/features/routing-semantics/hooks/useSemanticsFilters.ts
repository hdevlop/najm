import type { SemanticGroup } from '@/features/routing-semantics/types';

export function useSemanticsFilters(
  langGroups: SemanticGroup[],
  toolGroups: Array<{ value: string; label: string; total: number }>,
) {
  const langGroupOptions = [
    { value: '', label: 'All languages' },
    ...langGroups.map((g) => ({
      value: g.lang,
      label: `${g.lang.toUpperCase()} (${g.total})`,
    })),
  ];

  const toolGroupOptions = [
    { value: '', label: 'All groups' },
    ...toolGroups.map((group) => ({
      value: group.value,
      label: `${group.label} (${group.total})`,
    })),
  ];

  return { langGroupOptions, toolGroupOptions };
}