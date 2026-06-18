import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Params,
  Query,
  Inject,
  Req,
  User,
  HttpError,
} from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { McpTool, ToolGroup } from 'najm-mcp';
import { KnowledgeDocumentService } from '../knowledge/KnowledgeDocumentService';
import {
  knowledgeSearchDto,
  ingestTextDto,
  type KnowledgeSearchDto,
} from '../chatbotRag/ChatbotRagDto';
import { StudioAuditService } from './StudioAuditService';

@Controller('/rag-studio')
@ToolGroup('rag_studio')
@isAdmin()
export class KnowledgeController {
  @Inject() private docs!: KnowledgeDocumentService;
  @Inject() private audit!: StudioAuditService;

  @Get('/documents')
  async listDocs(@Query('namespace') ns?: string) {
    return this.docs.listDocuments(ns);
  }

  @Post('/documents/import')
  async importDocument(@Req() req: any, @User() user: any) {
    const contentType = req.raw.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const result = await this.docs.uploadDocument(formData);
      await this.audit.recordAudit('import_document', 'multipart-upload', user?.id ?? null);
      return result;
    }
    const raw = await req.json();
    const parsed = ingestTextDto.safeParse(raw);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      HttpError.badRequest(`Validation failed: ${errors.join(', ')}`);
    }
    const result = await this.docs.ingestTextDocument(parsed.data);
    await this.audit.recordAudit('import_document', `source=${parsed.data.sourceType}`, user?.id ?? null);
    return result;
  }

  @Get('/documents/:id/chunks')
  async chunks(@Params('id') id: string) {
    return this.docs.getDocumentChunks(id);
  }

  @Delete('/documents/:id')
  async deleteDoc(@Params('id') id: string, @User() user: any) {
    const result = await this.docs.deleteDocument(id);
    await this.audit.recordAudit('delete_document', `id=${id}`, user?.id ?? null);
    return result;
  }

  @Post('/documents/:id/reindex')
  async reindexDoc(@Params('id') id: string, @User() user: any) {
    const result = await this.docs.reindexDocument(id);
    await this.audit.recordAudit('reindex_document', `id=${id}`, user?.id ?? null);
    return result;
  }

  @Get('/knowledge/status')
  async knowledgeStatus() {
    return this.docs.getKnowledgeStatus();
  }

  @Post('/knowledge/search')
  @McpTool('Semantic vector search over the indexed knowledge base; returns ranked chunks with scores')
  @Validate(knowledgeSearchDto)
  async searchKnowledge(@Body() body: KnowledgeSearchDto) {
    return this.docs.searchKnowledge(body.query, body.limit, body.threshold);
  }

  @Get('/chunks')
  async listChunks(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const l = parseInt(limit ?? '50', 10);
    const o = parseInt(offset ?? '0', 10);
    return this.docs.listDocumentChunksWithPagination(l, o);
  }
}
