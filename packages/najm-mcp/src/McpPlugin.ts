import { plugin } from 'najm-core';
import { McpRegistryService } from './McpRegistryService';
import { McpScannerService } from './McpScannerService';
import { McpBuilderService } from './McpBuilderService';
import { McpTransportService } from './McpTransportService';
import { MCP_CONFIG } from './tokens';
import type { McpConfig } from './types';

export const mcp = (config: McpConfig) =>
  plugin('mcp')
    .version(config.version)
    .services(McpRegistryService, McpScannerService, McpBuilderService, McpTransportService)
    .config(MCP_CONFIG, config)
    .build();
