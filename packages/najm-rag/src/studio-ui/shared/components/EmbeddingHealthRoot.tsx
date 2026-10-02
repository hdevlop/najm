import { EmbeddingHealthBanner } from './EmbeddingHealthBanner';
import { useEmbeddingHealth } from '../hooks/useEmbeddingHealth';

export function EmbeddingHealthRoot() {
  const { health, checking, recheck } = useEmbeddingHealth();

  return <EmbeddingHealthBanner health={health} checking={checking} onRecheck={recheck} />;
}
