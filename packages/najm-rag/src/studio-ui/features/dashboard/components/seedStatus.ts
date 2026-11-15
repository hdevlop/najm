import type { SeedStatus } from '../hooks/useDashboardData';

export type SeedTone = 'good' | 'warn' | 'neutral' | 'bad';

/** One health row for the boot phrase seed: short value plus tone. */
export function seedHealth(seed: SeedStatus): { value: string; tone: SeedTone } {
  switch (seed.state) {
    case 'waiting': return { value: 'Starting', tone: 'neutral' };
    case 'running': return { value: `Seeding ${seed.done}/${seed.total}`, tone: 'warn' };
    case 'disabled': return { value: 'Off (indexOnBoot)', tone: 'neutral' };
    case 'skipped': return { value: 'Skipped', tone: 'warn' };
    case 'failed': return { value: `Stopped ${seed.done}/${seed.total}`, tone: 'bad' };
    case 'done':
      if (seed.failed > 0) return { value: `${seed.failed} failed`, tone: 'bad' };
      return { value: seed.inserted > 0 ? `+${seed.inserted} added` : 'Up to date', tone: 'good' };
  }
}

/**
 * What a person should know about the seed, or null: why it did not run,
 * which batches failed, which tool names are unknown. Hosts that log at ERROR
 * only had no other way to see this.
 */
export function seedProblem(seed: SeedStatus): string | null {
  const parts: string[] = [];
  if (seed.state === 'skipped' || seed.state === 'failed' || seed.failed > 0) {
    if (seed.lastError) parts.push(seed.lastError);
    if (seed.failed > 0) parts.push(`${seed.failed} of ${seed.total} phrases failed`);
  }
  const unknown = [...new Set(seed.unknownTools)];
  if (unknown.length) parts.push(`phrases for unregistered tools were skipped: ${unknown.join(', ')}`);
  return parts.length ? parts.join('. ') : null;
}
