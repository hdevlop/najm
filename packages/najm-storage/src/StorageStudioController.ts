// ============================================================================
// najm-storage - Studio Controller (admin API)
// ============================================================================

import { Controller, Get, Post, Delete, Put, Patch, Params, Body, Ctx, ArrayBufferBody, ContentType, Query } from 'najm-core';
import type { Context } from 'hono';
import { StorageService } from './StorageService';
import { AuditService } from './AuditService';
import type { PreviewOptions } from './types';

@Controller('/storage-studio')
export class StorageStudioController {
  constructor(
    private storage: StorageService,
    private audit: AuditService,
  ) {}

  @Get('/namespaces')
  async listNamespaces() {
    return this.storage.listNamespaces();
  }

  @Get('/:namespace/files')
  async listObjects(
    @Params('namespace') namespace: string,
    @Ctx() c: Context,
  ) {
    const q = c.req.query();
    const result = await this.storage.listObjects(namespace, {
      prefix: q.prefix,
      delimiter: q.delimiter,
      cursor: q.cursor,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
    });
    return {
      ...result,
      files: result.files.map((f) => ({
        ...f,
        url: this.storage.getServePath(namespace, f.filePath),
      })),
    };
  }

  @Post('/:namespace/folders')
  async createFolder(
    @Params('namespace') namespace: string,
    @Body() body: { path: string },
  ) {
    const created = await this.storage.createFolder(namespace, body.path);
    await this.audit.write({ actor: 'studio', action: 'create-folder', namespace, path: created });
    return { success: true, path: created };
  }

  @Post('/:namespace/files/move')
  async moveFile(
    @Params('namespace') namespace: string,
    @Body() body: { from: string; to: string; overwrite?: boolean },
  ) {
    await this.storage.moveFile(namespace, body.from, body.to, { overwrite: body.overwrite });
    await this.audit.write({ actor: 'studio', action: 'move', namespace, path: body.from, meta: { to: body.to } });
    return { success: true };
  }

  @Post('/:namespace/files/copy')
  async copyFile(
    @Params('namespace') namespace: string,
    @Body() body: { from: string; to: string; overwrite?: boolean },
  ) {
    await this.storage.copyFile(namespace, body.from, body.to, { overwrite: body.overwrite });
    await this.audit.write({ actor: 'studio', action: 'copy', namespace, path: body.from, meta: { to: body.to } });
    return { success: true };
  }

  @Post('/:namespace/files/batch-delete')
  async batchDelete(
    @Params('namespace') namespace: string,
    @Body() body: { paths: string[]; hard?: boolean },
  ) {
    const result = await this.storage.batchDelete(namespace, body.paths, { hard: body.hard });
    for (const p of result.deleted) {
      await this.audit.write({ actor: 'studio', action: body.hard ? 'hard-delete' : 'delete', namespace, path: p });
    }
    return result;
  }

  @Post('/:namespace/files/presign')
  async presign(
    @Params('namespace') namespace: string,
    @Body() body: { path: string; method?: string; ttlSeconds?: number },
  ) {
    const url = await this.storage.presign(namespace, body.path, body.method ?? 'GET', body.ttlSeconds ?? 300);
    return { url };
  }

  @Post('/:namespace/files/*')
  async uploadStudioFile(
    @Ctx() c: Context,
    @Params('namespace') namespace: string,
    @ArrayBufferBody() body: ArrayBuffer,
    @ContentType() contentType: string | undefined,
  ) {
    const filePath = this.extractFilePath(c, namespace, 'files/');
    const uploaded = await this.storage.uploadFile(namespace, filePath, body, contentType);
    await this.audit.write({ actor: 'studio', action: 'upload', namespace, path: filePath });
    return uploaded;
  }

  @Delete('/:namespace/files/*')
  async deleteStudioFile(@Ctx() c: Context, @Params('namespace') namespace: string) {
    const filePath = this.extractFilePath(c, namespace, 'files/');
    const hard = c.req.query('hard') === 'true';

    let deleted = false;
    if (!hard) {
      try {
        deleted = await this.storage.softDeleteFile(namespace, filePath);
      } catch {
        // provider does not support soft delete — fall through to hard delete
      }
    }

    if (!deleted) {
      try {
        await this.storage.deleteFile(namespace, filePath);
        deleted = true;
      } catch {
        deleted = false;
      }
    }

    if (deleted) {
      await this.audit.write({ actor: 'studio', action: hard ? 'hard-delete' : 'delete', namespace, path: filePath });
    }

    return { success: deleted };
  }

  @Get('/usage')
  async usage() {
    return this.storage.getUsage();
  }

  @Get('/activity')
  async activity(@Ctx() c: Context) {
    const q = c.req.query();
    return this.audit.list({
      namespace: q.namespace,
      limit: q.limit ? parseInt(q.limit, 10) : 50,
    });
  }

  @Get('/capabilities')
  async capabilities() {
    return this.storage.getCapabilities();
  }

  @Get('/:namespace/tags')
  async listTags(@Params('namespace') namespace: string) {
    return this.storage.listTags(namespace);
  }

  @Post('/:namespace/tags')
  async createTag(
    @Params('namespace') namespace: string,
    @Body() body: { name: string; color?: string },
  ) {
    const tag = await this.storage.createTag(namespace, body.name, body.color);
    await this.audit.write({ actor: 'studio', action: 'tag-create', namespace, meta: { tag: tag.name } });
    return tag;
  }

  @Delete('/:namespace/tags/:tagId')
  async deleteTag(
    @Params('namespace') namespace: string,
    @Params('tagId') tagId: string,
  ) {
    await this.storage.deleteTag(namespace, tagId);
    await this.audit.write({ actor: 'studio', action: 'tag-delete', namespace, meta: { tagId } });
    return { success: true };
  }

  @Put('/:namespace/tags/:tagId')
  async updateTag(
    @Params('namespace') namespace: string,
    @Params('tagId') tagId: string,
    @Body() body: { name?: string; color?: string | null },
  ) {
    const tag = await this.storage.updateTag(namespace, tagId, body);
    await this.audit.write({ actor: 'studio', action: 'tag-update', namespace, meta: { tagId, ...body } });
    return tag;
  }

  @Get('/:namespace/files/tags')
  async getFileTags(
    @Params('namespace') namespace: string,
    @Query('path') path: string,
  ) {
    return this.storage.getFileTags(namespace, path);
  }

  @Put('/:namespace/files/tags')
  async setFileTags(
    @Params('namespace') namespace: string,
    @Body() body: { path: string; tags: string[] },
  ) {
    const tags = await this.storage.setFileTags(namespace, body.path, body.tags);
    await this.audit.write({ actor: 'studio', action: 'tag-assign', namespace, path: body.path, meta: { tags: body.tags } });
    return tags;
  }

  @Patch('/:namespace/files/tags')
  async patchFileTags(
    @Params('namespace') namespace: string,
    @Body() body: { paths: string[]; add?: string[]; remove?: string[] },
  ) {
    const result = await this.storage.patchFileTags(namespace, body.paths, { add: body.add, remove: body.remove });
    await this.audit.write({ actor: 'studio', action: 'tag-assign', namespace, meta: { paths: body.paths, add: body.add, remove: body.remove } });
    return result;
  }

  @Get('/:namespace/files-by-tag')
  async listFilesByTag(
    @Params('namespace') namespace: string,
    @Query('tag') tag: string,
    @Ctx() c: Context,
  ) {
    const q = c.req.query();
    return this.storage.listFilesByTag(namespace, tag, {
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
    });
  }

  private extractFilePath(c: Context, namespace: string, afterSegment: string): string {
    const wildcard = c.req.param('*');
    if (wildcard) return wildcard;
    const marker = `${namespace}/${afterSegment}`;
    const idx = c.req.path.indexOf(marker);
    if (idx === -1) return '';
    return decodeURIComponent(c.req.path.slice(idx + marker.length));
  }

  @Get('/trash')
  async listTrash() {
    return this.storage.listTrash();
  }

  @Post('/trash/restore')
  async restore(@Body() body: { namespace: string; path: string }) {
    const ok = await this.storage.restoreFile(body.namespace, body.path);
    return { restored: ok };
  }

  @Get('/preview-url')
  async previewUrl(
    @Query('namespace') namespace: string,
    @Query('path') path: string,
    @Query('w') w: string | undefined,
    @Query('h') h: string | undefined,
    @Query('q') q: string | undefined,
    @Query('format') format: string | undefined,
    @Query('fit') fit: string | undefined,
  ) {
    const opts: PreviewOptions = {
      width: w ? parseInt(w, 10) : undefined,
      height: h ? parseInt(h, 10) : undefined,
      quality: q ? parseInt(q, 10) : undefined,
      format: this.clampFormat(format),
      fit: this.clampFit(fit),
    };
    const url = this.storage.getPreviewPath(namespace, path, opts);
    return { url };
  }

  @Get('/preview')
  async preview(
    @Ctx() c: Context,
    @Query('namespace') namespace: string,
    @Query('path') path: string,
    @Query('w') w: string | undefined,
    @Query('h') h: string | undefined,
    @Query('q') q: string | undefined,
    @Query('format') format: string | undefined,
    @Query('fit') fit: string | undefined,
  ): Promise<Response> {
    const opts: PreviewOptions = {
      width: w ? parseInt(w, 10) : undefined,
      height: h ? parseInt(h, 10) : undefined,
      quality: q ? parseInt(q, 10) : undefined,
      format: this.clampFormat(format),
      fit: this.clampFit(fit),
    };
    const preview = await this.storage.servePreview(namespace, path, opts);
    if (preview) return preview;
    // Fallback: stream original file through studio auth
    return this.storage.serveFile(namespace, path);
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
}
