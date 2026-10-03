import { createHash } from 'crypto';
import type { ToolIndexInput } from './ToolIndexDto';

/** What shapes a stored vector besides the tool itself. */
export interface ToolIndexEmbedder {
  provider?: string;
  model?: string;
  dimensions?: number;
  truncateDimensions?: boolean;
  documentPrefix?: string;
}

/**
 * Changes when the tool or, if given, the embedder changes, so switching the
 * embedding model re-indexes every tool instead of leaving vectors from the
 * old model to be searched with the new one.
 */
export function createFingerprint(tool: ToolIndexInput, embedder?: ToolIndexEmbedder): string {
  const payload = JSON.stringify({
    name: tool.name,
    description: tool.description,
    group: tool.group,
    localName: tool.localName,
    argNames: tool.argNames,
    annotations: tool.annotations,
    ...(embedder ? {
      embedder: {
        provider: embedder.provider ?? null,
        model: embedder.model ?? null,
        dimensions: embedder.dimensions ?? null,
        truncateDimensions: embedder.truncateDimensions ?? false,
        documentPrefix: embedder.documentPrefix ?? '',
      },
    } : {}),
  });
  return createHash('sha1').update(payload).digest('hex');
}

export function buildIndexText(tool: ToolIndexInput): string {
  const parts = [
    `Tool: ${tool.name}`,
    tool.group ? `Group: ${tool.group}` : '',
    `Description: ${tool.description}`,
    tool.argNames?.length ? `Arguments: ${tool.argNames.join(', ')}` : '',
    tool.annotations ? `Annotations: ${JSON.stringify(tool.annotations)}` : '',
  ];
  return parts.filter(Boolean).join('\n');
}
