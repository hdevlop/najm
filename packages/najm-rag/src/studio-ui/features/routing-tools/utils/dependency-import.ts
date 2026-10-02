import type { MCPTool } from '@/features/routing-tools/types';

export function normalizeDependencyImport(
  payload: unknown,
  tools: MCPTool[],
): Record<string, string[]> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid dependencies JSON.');
  }

  const source =
    'dependencies' in payload
      ? (payload as { dependencies?: unknown }).dependencies
      : payload;

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Expected { "dependencies": { "tool": ["dep"] } }.');
  }

  const toolNames = new Set(tools.map((tool) => tool.name));
  const output: Record<string, string[]> = {};

  for (const [toolName, deps] of Object.entries(source as Record<string, unknown>)) {
    if (!toolNames.has(toolName)) continue;
    if (!Array.isArray(deps)) continue;

    const cleanDeps = [
      ...new Set(
        deps
          .filter((dep): dep is string => typeof dep === 'string')
          .map((dep) => dep.trim())
          .filter((dep) => dep && dep !== toolName && toolNames.has(dep)),
      ),
    ];

    if (cleanDeps.length > 0) {
      output[toolName] = cleanDeps;
    }
  }

  return output;
}
