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
  // MCP registry resolution (najm-mcp is an optional peer dep)
  // ---------------------------------------------------------------------------

  /**
   * Resolved through `Symbol.for('najm:mcp:registry')`, which `mcp()` aliases to
   * its own `McpRegistryService`.
   *
   * Not through the class: this package and `najm-mcp` are separate resolutions,
   * and an application that maps one specifier to `src` while this file's
   * `import('najm-mcp')` reaches `dist` holds two different constructors. The
   * container answers the wrong one by building a second, empty registry — so
   * every tool below registers into a registry that is never served, and no
   * error is raised anywhere. The string is duplicated rather than imported so
   * this stays independent of which copy of `najm-mcp` loads.
   */
  private async resolveMcpRegistry(): Promise<McpRegistryServiceLike> {
    const MCP_REGISTRY = Symbol.for('najm:mcp:registry');

    if (!this.container.has(MCP_REGISTRY)) {
      throw new Error('[najm/storage] MCP tools require the mcp() plugin. Register mcp() before storage({ mcp: true }). If najm-mcp is not installed: bun add najm-mcp');
    }

    // Deliberately uncaught: a registered registry that fails while constructing
    // should surface its own error, not be reported as a missing plugin.
    return await this.container.resolve(MCP_REGISTRY);
  }
}
