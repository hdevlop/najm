import { randomUUID } from 'node:crypto';
import type { RegisteredTool, McpBuilderService } from 'najm-mcp';
import type { ReplyTemplate, ReplyToolCall } from './replyPolicy';
import type { ToolSettledEvent } from './McpToolAdapter';

export interface TemplateCallResult extends ReplyToolCall {
  id: string;
  output: unknown;
}

/** Pure preflight: no reads or rendering before a candidate wins. */
export function validateReplyTemplate(template: ReplyTemplate, availableTools: RegisteredTool[], builder: McpBuilderService | null): void {
  if (!template || typeof template !== 'object') throw new Error('Invalid reply template');
  if ('text' in template) {
    if (typeof template.text !== 'string' || !template.text.trim() || 'calls' in template) throw new Error('Empty or ambiguous reply template');
    return;
  }
  if (!builder || !Array.isArray(template.calls) || !template.calls.length || template.calls.length > 8
    || typeof template.render !== 'function') throw new Error('Invalid reply template tool plan');
  for (const call of template.calls) {
    if (!call || typeof call.name !== 'string' || !call.input || typeof call.input !== 'object' || Array.isArray(call.input)) throw new Error('Invalid reply template tool input');
    const tool = availableTools.find(tool => tool.name === call.name);
    if (!tool || tool.annotations?.readOnlyHint !== true || tool.confirmation
      || tool.annotations?.destructive || tool.annotations?.destructiveHint) {
      throw new Error('Reply templates may use only available, explicitly read-only tools');
    }
  }
}

/** All tools are prechecked before the first read; MCP still owns validation and guards. */
export async function executeReplyTemplate(
  template: ReplyTemplate,
  availableTools: RegisteredTool[],
  builder: McpBuilderService | null,
  onCall: (event: ToolSettledEvent) => void,
  signal?: AbortSignal,
): Promise<{ text: string; calls: TemplateCallResult[] }> {
  signal?.throwIfAborted();
  validateReplyTemplate(template, availableTools, builder);
  if ('text' in template) {
    if (!template.text.trim()) throw new Error('Empty reply template');
    return { text: template.text, calls: [] };
  }
  const calls: TemplateCallResult[] = [];
  for (const call of template.calls) {
    const id = randomUUID();
    const start = performance.now();
    let outcome: ToolSettledEvent['outcome'] = 'error';
    let resultChars = 0;
    try {
      const result = await builder!.invokeTool(call.name, call.input);
      signal?.throwIfAborted();
      resultChars = JSON.stringify(result).length;
      if (result.isError) throw new Error('Reply template read failed');
      const content = result.content?.find(item => item.type === 'text');
      if (!content || content.type !== 'text') throw new Error('Missing reply template data');
      const output: unknown = JSON.parse(content.text);
      calls.push({ ...call, id, output });
      outcome = 'executed';
    } finally {
      onCall({ name: call.name, toolCallId: id, outcome, start, end: performance.now(),
        inputChars: JSON.stringify(call.input).length, resultChars });
    }
  }
  const text = template.render(calls.map(call => call.output));
  signal?.throwIfAborted();
  if (!text.trim()) throw new Error('Empty reply template');
  return { text, calls };
}
