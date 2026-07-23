// ============================================================================
// najm-storage - MCP Tools
// ============================================================================

import { Container, DI, Meta, Service } from 'najm-core';
import { z } from 'zod';
import type { FileInfo } from './types';
import { StorageService } from './StorageService';

const storageListSchema = z.object({
  namespace: z.string().describe('Namespace (e.g. book ID, entity ID)'),
});

const storageFileSchema = z.object({
  namespace: z.string().describe('Namespace (e.g. book ID, entity ID)'),
  filePath: z.string().describe('Relative file path (e.g. "icons/star.png")'),
});

const storageUploadSchema = z.object({
  namespace: z.string().describe('Namespace (e.g. book ID, entity ID)'),
  filePath: z.string().describe('Relative file path (e.g. "icons/star.png")'),
  base64Data: z.string().describe('File content as base64-encoded string'),
});

const storageUploadFromPathSchema = z.object({
  namespace: z.string().describe('Namespace (e.g. book ID, entity ID)'),
  filePath: z.string().describe('Destination file path (e.g. "diagrams/circuit.png")'),
  sourcePath: z.string().describe('Absolute path to source file on disk (e.g. "/tmp/image.png")'),
});

type StorageListInput = z.infer<typeof storageListSchema>;
type StorageFileInput = z.infer<typeof storageFileSchema>;
type StorageUploadInput = z.infer<typeof storageUploadSchema>;
type StorageUploadFromPathInput = z.infer<typeof storageUploadFromPathSchema>;

interface RegisteredToolLike {
  name: string;
  description: string;
  methodKey: string;
  target: new (...args: any[]) => any;
  args: Array<{ index: number; name: string; schema: z.ZodTypeAny }>;
  validation?: {
    body?: { parse: (data: unknown) => unknown };
  };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
}

interface McpRegistryServiceLike {
  registerTool(tool: RegisteredToolLike): void;
}

@Meta({ layer: 'plugin' })
export class StorageMcpTools {
  @DI() private container!: Container;

  private toolsRegistered = false;

  constructor(private storageService: StorageService) {}

  async activate(): Promise<void> {
    if (this.toolsRegistered) return;

    const registry = await this.resolveMcpRegistry();

    registry.registerTool({
      name: 'storage_list',
      description: 'List all files in a namespace',
      methodKey: 'storageList',
      target: StorageMcpTools,
      args: [],
      validation: { body: storageListSchema },
      annotations: { readOnlyHint: true },
    });

    registry.registerTool({
      name: 'storage_info',
      description: 'Get file metadata (size, type, dates)',
      methodKey: 'storageInfo',
      target: StorageMcpTools,
      args: [],
      validation: { body: storageFileSchema },
      annotations: { readOnlyHint: true },
    });

    registry.registerTool({
      name: 'storage_upload',
      description: 'Upload a file (base64) to a namespace',
      methodKey: 'storageUpload',
      target: StorageMcpTools,
      args: [],
      validation: { body: storageUploadSchema },
      annotations: { idempotentHint: true },
    });

    registry.registerTool({
      name: 'storage_upload_from_path',
      description: 'Upload a file from a local disk path to a namespace (no base64 encoding needed)',
      methodKey: 'storageUploadFromPath',
      target: StorageMcpTools,
      args: [],
      validation: { body: storageUploadFromPathSchema },
      annotations: { idempotentHint: true },
    });

    registry.registerTool({
      name: 'storage_delete',
      description: 'Delete a file from a namespace',
      methodKey: 'storageDelete',
      target: StorageMcpTools,
      args: [],
      validation: { body: storageFileSchema },
      annotations: { destructiveHint: true },
    });

    this.toolsRegistered = true;
  }

  // ---------------------------------------------------------------------------
  // Handlers — input is already parsed by MCP validation layer
  // ---------------------------------------------------------------------------

  async storageList(input: StorageListInput): Promise<FileInfo[]> {
    return this.storageService.listFiles(input.namespace);
  }

  async storageInfo(input: StorageFileInput): Promise<FileInfo> {
    return this.storageService.getFileInfo(input.namespace, input.filePath);
  }

  async storageUpload(input: StorageUploadInput): Promise<FileInfo> {
    return this.storageService.uploadBase64File(input.namespace, input.filePath, input.base64Data);
  }

  async storageUploadFromPath(input: StorageUploadFromPathInput): Promise<FileInfo> {
    return this.storageService.uploadFromPath(input.namespace, input.filePath, input.sourcePath);
  }

  async storageDelete(input: StorageFileInput): Promise<{ message: string; namespace: string; filePath: string }> {
    return this.storageService.deleteFile(input.namespace, input.filePath);
  }

  // ---------------------------------------------------------------------------
  // MCP registry resolution (dynamic import — najm-mcp is optional peer dep)
  // ---------------------------------------------------------------------------

  private async resolveMcpRegistry(): Promise<McpRegistryServiceLike> {
    let mod: unknown;

    try {
      mod = await import('najm-mcp');
    } catch {
      throw new Error('[najm/storage] MCP tools enabled but najm-mcp is not installed. Install with: bun add najm-mcp');
    }

    const mcpModule = mod as { McpRegistryService?: new (...args: any[]) => unknown };
    const registryToken = mcpModule.McpRegistryService;

    if (typeof registryToken !== 'function') {
      throw new Error('[najm/storage] McpRegistryService unavailable from najm-mcp.');
    }

    try {
      return await this.container.resolve(registryToken as any);
    } catch {
      throw new Error('[najm/storage] MCP tools require mcp() plugin. Register mcp() before storage({ mcp: true }).');
    }
  }
}
