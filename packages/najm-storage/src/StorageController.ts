// ============================================================================
// najm-storage - Storage Controller
// ============================================================================

import { Controller, Get, Post, Delete } from 'najm-core';
import { Params, Ctx, ArrayBufferBody, ContentType } from 'najm-core';
import type { Context } from 'hono';
import { StorageService } from './StorageService';

@Controller('')
export class StorageController {
  constructor(private storageService: StorageService) {}

  /**
   * Extract wildcard file path from the request URL.
   *
   * `c.req.param('*')` returns `undefined` when mixed with named params
   * (`:namespace`) in certain Hono router configurations. This method
   * reliably extracts the wildcard segment from `c.req.path` instead.
   */
  private extractFilePath(c: Context, namespace: string, afterSegment: string): string {
    const wildcard = c.req.param('*');
    if (wildcard) return wildcard;

    const marker = `${namespace}/${afterSegment}`;
    const idx = c.req.path.indexOf(marker);
    if (idx === -1) return '';
    return decodeURIComponent(c.req.path.slice(idx + marker.length));
  }

  // ============================================================================
  // GET /:namespace/files — list all files in namespace
  // ============================================================================

  @Get('/:namespace/files')
  async listFiles(@Params('namespace') namespace: string) {
    return this.storageService.listFiles(namespace);
  }

  // ============================================================================
  // GET /:namespace/files/info/* — get single file metadata
  // ============================================================================

  @Get('/:namespace/files/info/*')
  async getFileInfo(
    @Ctx() c: Context,
    @Params('namespace') namespace: string,
  ) {
    const filePath = this.extractFilePath(c, namespace, 'files/info/');
    return this.storageService.getFileInfo(namespace, filePath);
  }

  // ============================================================================
  // GET /:namespace/files/serve/* — serve file binary
  // ============================================================================

  @Get('/:namespace/files/serve/*')
  async serveFile(
    @Ctx() c: Context,
    @Params('namespace') namespace: string,
  ): Promise<Response> {
    const filePath = this.extractFilePath(c, namespace, 'files/serve/');
    return this.storageService.serveFile(namespace, filePath);
  }

  // ============================================================================
  // POST /:namespace/files/* — upload file
  // ============================================================================

  @Post('/:namespace/files/*')
  async uploadFile(
    @Ctx() c: Context,
    @Params('namespace') namespace: string,
    @ArrayBufferBody() body: ArrayBuffer,
    @ContentType() contentType: string | undefined,
  ) {
    const filePath = this.extractFilePath(c, namespace, 'files/');
    return this.storageService.uploadFile(namespace, filePath, body, contentType);
  }

  // ============================================================================
  // DELETE /:namespace/files/* — delete single file
  // ============================================================================

  @Delete('/:namespace/files/*')
  async deleteFile(
    @Ctx() c: Context,
    @Params('namespace') namespace: string,
  ) {
    const filePath = this.extractFilePath(c, namespace, 'files/');
    return this.storageService.deleteFile(namespace, filePath);
  }

  // ============================================================================
  // DELETE /:namespace/files — delete all files in namespace
  // ============================================================================

  @Delete('/:namespace/files')
  async deleteNamespace(@Params('namespace') namespace: string) {
    return this.storageService.deleteNamespace(namespace);
  }
}
