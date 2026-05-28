// ============================================================================
// najm-storage - Storage Controller
// ============================================================================

import { Controller, Get, Post, Delete, Query } from 'najm-core';
import { Params, Ctx, ArrayBufferBody, ContentType } from 'najm-core';
import type { Context } from 'hono';
import { StorageService } from './StorageService';
import type { PreviewOptions } from './types';

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

  @Get('/:namespace/files/preview/*')
  async servePreview(
    @Ctx() c: Context,
    @Params('namespace') namespace: string,
    @Query('w') w: string | undefined,
    @Query('h') h: string | undefined,
    @Query('q') q: string | undefined,
    @Query('format') format: string | undefined,
    @Query('fit') fit: string | undefined,
  ): Promise<Response> {
    const filePath = this.extractFilePath(c, namespace, 'files/preview/');
    const opts: PreviewOptions = {
      width: w ? parseInt(w, 10) : undefined,
      height: h ? parseInt(h, 10) : undefined,
      quality: q ? parseInt(q, 10) : undefined,
      format: this.clampFormat(format),
      fit: this.clampFit(fit),
    };
    const preview = await this.storageService.servePreview(namespace, filePath, opts);
    if (preview) return preview;
    // Fallback: redirect to original serve URL
    const serveUrl = this.storageService.getServePath(namespace, filePath);
    return c.redirect(serveUrl, 302);
  }

  private clampFormat(format: string | undefined): PreviewOptions['format'] {
    if (!format) return 'original';
    const allowed = ['jpeg', 'png', 'webp', 'original'];
    return (allowed.includes(format) ? format : 'original') as PreviewOptions['format'];
  }

  private clampFit(fit: string | undefined): PreviewOptions['fit'] {
    if (!fit) return 'cover';
    const allowed = ['cover', 'contain', 'inside', 'outside'];
    return (allowed.includes(fit) ? fit : 'cover') as PreviewOptions['fit'];
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
