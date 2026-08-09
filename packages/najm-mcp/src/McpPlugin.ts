import { plugin } from 'najm-core';
import { McpRegistryService } from './McpRegistryService';
import { McpScannerService } from './McpScannerService';
import { McpBuilderService } from './McpBuilderService';
import { McpTransportService } from './McpTransportService';
import { MCP_CONFIG, MCP_REGISTRY } from './tokens';
import type { McpConfig } from './types';

export const mcp = (config: McpConfig) =>
  plugin('mcp')
    .version(config.version)
    .services(McpRegistryService, McpScannerService, McpBuilderService, McpTransportService)
    // The identity-stable way in for packages that contribute tools. The alias
    // forwards to the same singleton this plugin registered, so a tool provider
    // loaded from a different copy of `najm-mcp` still lands in this registry.
    .alias(MCP_REGISTRY, McpRegistryService)
    .config(MCP_CONFIG, config)
    .build();
