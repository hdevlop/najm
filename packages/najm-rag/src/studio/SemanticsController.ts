import {
  Controller,
  Get,
  Post,
  Patch,
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
import { z } from 'zod';
import { isAdmin } from 'najm-auth';
import { McpTool, ToolGroup } from 'najm-mcp';
import { SemanticImportJobService } from '../chatbotRag/SemanticImportJobService';
import { SemanticPhraseService } from '../chatbotRag/SemanticPhraseService';
import {
  importSemanticsDto,
  createSemanticDto,
  updateSemanticDto,
  previewRoutingDto,
  type ImportSemanticsDto,
  type CreateSemanticDto,
  type UpdateSemanticDto,
  type PreviewRoutingDto,
} from '../chatbotRag/ChatbotRagDto';
import { StudioAuditService } from './StudioAuditService';

const idsBatchDto = z.object({ ids: z.array(z.string().min(1)).min(1) });

const normalizeSemanticImportContent = (input: unknown): Record<string, Record<string, string[]>> => {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const groupedSource = source.tools && typeof source.tools === 'object' && !Array.isArray(source.tools)
    ? source.tools as Record<string, unknown>
    : source;
  const grouped: Record<string, Record<string, string[]>> = {};

  if (Array.isArray((source as any).items)) {
    for (const item of (source as any).items) {
      const toolName = typeof item?.toolName === 'string' ? item.toolName.trim() : '';
      if (!toolName) continue;
      for (const phraseItem of Array.isArray(item?.phrases) ? item.phrases : []) {
        const phrase = typeof phraseItem?.phrase === 'string' ? phraseItem.phrase.trim() : '';
        const lang = typeof phraseItem?.lang === 'string' && phraseItem.lang.trim() ? phraseItem.lang.trim() : 'und';
        if (!phrase) continue;
        grouped[toolName] ??= {};
        grouped[toolName][lang] ??= [];
        grouped[toolName][lang].push(phrase);
      }
    }
    return grouped;
  }

  for (const [toolName, langs] of Object.entries(groupedSource)) {
    if (!langs || typeof langs !== 'object' || Array.isArray(langs)) continue;
    for (const [lang, phrases] of Object.entries(langs as Record<string, unknown>)) {
      if (!Array.isArray(phrases)) continue;
      const clean = phrases.map((phrase) => String(phrase).trim()).filter(Boolean);
      if (clean.length === 0) continue;
      grouped[toolName] ??= {};
      grouped[toolName][lang] ??= [];
      grouped[toolName][lang].push(...clean);
    }
  }

  return grouped;
};

@Controller('/rag-studio')
@ToolGroup('rag_studio')
@isAdmin()
export class SemanticsController {
  @Inject() private semantics!: SemanticPhraseService;
  @Inject() private importJob!: SemanticImportJobService;
  @Inject() private audit!: StudioAuditService;

  @Get('/semantics')
  @McpTool('List semantic phrases mapped to tools, optionally filtered by toolName/toolGroup/lang/search with pagination')
  async listSemantics(
    @Query('toolName') toolName?: string,
    @Query('toolGroup') toolGroup?: string,
    @Query('lang') lang?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (limit !== undefined || offset !== undefined || lang !== undefined || search !== undefined || toolGroup !== undefined) {
      const parsedLimit = limit ? Number(limit) : undefined;
      const parsedOffset = offset ? Number(offset) : undefined;
      return this.semantics.listSemanticsPaginated({
        toolName,
        toolGroup,
        lang,
        search,
        limit: parsedLimit != null && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        offset: parsedOffset != null && Number.isFinite(parsedOffset) ? parsedOffset : undefined,
      });
    }
    return this.semantics.listSemantics(toolName);
  }

  @Get('/semantics/groups')
  @McpTool('Get semantic phrase counts grouped by toolName/lang')
  async semanticGroups(@Query('toolName') toolName?: string, @Query('toolGroup') toolGroup?: string) {
    return this.semantics.getSemanticGroups(toolName, toolGroup);
  }

  @Get('/semantics/export')
  @McpTool('Export all semantic phrases as JSON (toolName -> lang -> phrases[])')
  async exportSemantics() {
    return this.semantics.exportSemantics();
  }

  @Get('/semantics/:id')
  @McpTool('Get a single semantic phrase mapping by id')
  async getSemantic(@Params('id') id: string) {
    return this.semantics.getSemanticById(id);
  }

  @Post('/semantics')
  @McpTool('Create a single semantic phrase mapping for a tool (toolName + phrase + lang)')
  @Validate(createSemanticDto)
  async createSemantic(@Body() body: CreateSemanticDto, @User() user: any) {
    const result = await this.semantics.createSemantic(body);
    await this.audit.recordAudit('create_semantic', `tool=${body.toolName}`, user?.id ?? null);
    return result;
  }

  @Post('/semantics/import')
  @McpTool('Bulk import semantic phrases. Accepts items: [{ toolName, phrases: [{ phrase, lang }] }]. Use this to seed a tool with LLM-generated phrasings')
  @Validate(importSemanticsDto)
  async importSemantics(@Body() body: ImportSemanticsDto, @User() user: any) {
    const result = await this.semantics.importSemantics(body);
    await this.audit.recordAudit('import_semantics', `count=${(body as any).items?.length ?? 0}`, user?.id ?? null);
    return result;
  }

  @Post('/semantics/reindex')
  @McpTool('Reindex all semantic phrases (regenerate embeddings)')
  async reindexSemantics(@User() user: any) {
    const result = await this.semantics.reindexSemantics();
    await this.audit.recordAudit('reindex_semantics', 'Reindex all semantics', user?.id ?? null);
    return result;
  }

  @Patch('/semantics/:id')
  @McpTool('Update a semantic phrase mapping (phrase, lang, toolName)')
  @Validate(updateSemanticDto)
  async updateSemantic(@Params('id') id: string, @Body() body: UpdateSemanticDto, @User() user: any) {
    const result = await this.semantics.updateSemantic(id, body);
    await this.audit.recordAudit('update_semantic', `id=${id}`, user?.id ?? null);
    return result;
  }

  @Post('/semantics/delete-batch')
  @McpTool('Delete a batch of semantic phrases by id (bulk delete).')
  @Validate(idsBatchDto)
  async deleteSemanticsBatch(@Body() body: { ids: string[] }, @User() user: any) {
    const result = await this.semantics.deleteSemanticsBatch(body.ids);
    await this.audit.recordAudit('delete_semantics_batch', `count=${result.deleted}`, user?.id ?? null);
    return result;
  }

  @Delete('/semantics')
  async deleteAllSemantics(@User() user: any) {
    const result = await this.semantics.deleteAllSemantics();
    await this.audit.recordAudit('delete_all_semantics', `deleted=${result.deleted}`, user?.id ?? null);
    return result;
  }

  @Delete('/semantics/:id')
  @McpTool('Delete a single semantic phrase mapping by id')
  async deleteSemantic(@Params('id') id: string, @User() user: any) {
    const result = await this.semantics.deleteSemantic(id);
    await this.audit.recordAudit('delete_semantic', `id=${id}`, user?.id ?? null);
    return result;
  }

  @Post('/semantics/import-jobs')
  async createImportJob(@Req() req: any, @User() user: any) {
    const contentType = req.raw.headers.get('content-type') ?? '';
    let files: Array<{ name: string; content: Record<string, Record<string, string[]>> }>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      files = [];
      const fileEntries = formData.getAll('files');
      if (fileEntries.length === 0) {
        const single = formData.get('file');
        if (single && typeof single === 'object' && 'text' in single) {
          fileEntries.push(single);
        }
      }
      for (const entry of fileEntries) {
        if (typeof entry === 'object' && 'text' in entry) {
          const file = entry as File;
          const raw = await file.text();
          files.push({ name: file.name, content: normalizeSemanticImportContent(JSON.parse(raw)) });
        }
      }
    } else {
      const body = await req.json();
      files = [{ name: 'import.json', content: normalizeSemanticImportContent(body) }];
    }

    if (files.length === 0) {
      HttpError.badRequest('No files provided for import');
    }

    if (files.every((file) => Object.keys(file.content).length === 0)) {
      HttpError.badRequest('No semantic phrases found. Expected { toolName: { lang: string[] } }, { tools: ... }, or { items: [...] }.');
    }

    const job = await this.importJob.createImportJob(files);
    await this.audit.recordAudit('create_import_job', `jobId=${job.jobId} files=${files.length}`, user?.id ?? null);
    return job;
  }

  @Get('/semantics/import-jobs/:jobId')
  async getImportJob(@Params('jobId') jobId: string) {
    const job = this.importJob.getImportJob(jobId);
    if (!job) HttpError.notFound(`Import job not found: ${jobId}`);
    return job;
  }

  @Post('/routing/preview')
  @McpTool('Preview which tool a query would route to (use this to test semantic coverage of a phrase)')
  @Validate(previewRoutingDto)
  async previewRouting(@Body() body: PreviewRoutingDto) {
    return this.semantics.previewRouting(body.query);
  }
}
