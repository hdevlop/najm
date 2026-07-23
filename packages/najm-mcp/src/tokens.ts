import type { RegisteredTool } from './types';

export const MCP_CONFIG = Symbol.for('najm:mcp:config');

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
