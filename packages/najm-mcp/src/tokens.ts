import type { RegisteredTool } from './types';

export const MCP_CONFIG = Symbol.for('najm:mcp:config');

/**
 * Resolution token for the one `McpRegistryService` this server owns.
 *
 * A class is only a usable DI token while every caller holds the *same*
 * constructor. Another workspace package resolving `najm-mcp` through its own
 * `node_modules` (dist) while the application resolves it through a tsconfig
 * path (src) holds a different constructor, so `container.resolve(McpRegistryService)`
 * quietly builds it a second, empty registry: its tools register, and none of
 * them ever reach `/mcp/tools`.
 *
 * `Symbol.for` is keyed on the string in a process-wide registry, so every copy
 * of this module produces the identical symbol. External packages contributing
 * tools must resolve this token, never the class.
 */
export const MCP_REGISTRY = Symbol.for('najm:mcp:registry');

export const MCP_GROUP_META = Symbol.for('najm:mcp:group');
export const MCP_TOOL_META = Symbol.for('najm:mcp:tool');
export const MCP_ANNOTATIONS_META = Symbol.for('najm:mcp:annotations');
export const MCP_CONFIRMATION_META = Symbol.for('najm:mcp:confirmation');
export const MCP_CONTROLLER_TOOL_META = Symbol.for('mcp:controller-tool');

export const TOOL_PROVIDER = Symbol.for('najm:tool-provider');

export interface ToolProvider {
  findRelevantTools(userText: string): Promise<{
    status: 'disabled' | 'routed' | 'fallback_all' | 'fallback_none' | 'router_error';
    tools: RegisteredTool[];
    error?: string;
  }>;
}
