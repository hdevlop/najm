import type { RegisteredTool } from 'najm-mcp';

export function isInternalRagTool(tool: Pick<RegisteredTool, 'group' | 'name'>): boolean {
  return tool.group === 'rag_studio' || tool.name.startsWith('rag_studio_');
}

export function getRoutableTools<T extends Pick<RegisteredTool, 'group' | 'name'>>(tools: T[]): T[] {
  return tools.filter((tool) => !isInternalRagTool(tool));
}
