import { createHash } from 'crypto';
import type { ToolIndexInput } from './ToolIndexDto';

export function createFingerprint(tool: ToolIndexInput): string {
  const payload = JSON.stringify({
    name: tool.name,
    description: tool.description,
    group: tool.group,
    localName: tool.localName,
    argNames: tool.argNames,
    annotations: tool.annotations,
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
