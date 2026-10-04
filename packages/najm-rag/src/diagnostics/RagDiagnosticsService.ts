import { Service } from 'najm-core';
import { withEmbeddingDiagnostics, type EmbeddingDiagnosticsOptions, type RagDiagnosticsRunner } from './EmbeddingDiagnostics';

/** DI bridge for optional consumers such as najm-chatbot. */
@Service()
export class RagDiagnosticsService implements RagDiagnosticsRunner {
  run<T>(options: EmbeddingDiagnosticsOptions, work: () => T | Promise<T>): Promise<T> {
    return withEmbeddingDiagnostics(options, work);
  }
}
