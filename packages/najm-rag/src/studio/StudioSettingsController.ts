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
  User,
  HttpError,
} from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { McpTool, ToolGroup } from 'najm-mcp';
import { SemanticPhraseService } from '../chatbotRag/SemanticPhraseService';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { RoutingSettingsService } from '../routingSettings/RoutingSettingsService';
import { updateRoutingSettingsSchema } from '../routingSettings/RoutingSettingsDto';
import { StudioAuditService } from './StudioAuditService';
import { UnmatchedQueryService } from '../unmatched/UnmatchedQueryService';

@Controller('/rag-studio')
@ToolGroup('rag_studio')
@isAdmin()
export class StudioSettingsController {
  @Inject() private semantics!: SemanticPhraseService;
  @Inject() private settings!: RoutingSettingsService;
  @Inject() private audit!: StudioAuditService;
  @Inject() private embedding!: EmbeddingService;
  @Inject() private unmatched!: UnmatchedQueryService;

  @Get('/status')
  @McpTool('Get RAG studio status: dialect, embedding model/dimensions, indexed/registered tool counts')
  async status() {
    return this.semantics.getStatus();
  }

  @Get('/health/embedding')
  async embeddingHealth() {
    return this.embedding.health();
  }

  @Get('/settings')
  async getSettings() {
    return this.settings.getEffectiveSettings();
  }

  @Patch('/settings')
  @Validate(updateRoutingSettingsSchema)
  async updateSettings(@Body() body: any, @User() user: any) {
    const result = await this.settings.updateSettings(body);
    await this.audit.recordAudit('update_settings', JSON.stringify(body), user?.id ?? null);
    return result;
  }

  @Get('/settings/index')
  async indexSettings() {
    const status = await this.semantics.getStatus();
    const settings = await this.settings.getEffectiveSettings();
    return {
      embeddingProvider: 'ollama',
      embeddingModel: status.embeddingModel ?? 'embeddinggemma',
      embeddingDimensions: status.embeddingDimensions ?? 768,
      vectorStoreDriver: status.dialect === 'sqlite' ? 'sqlite-vec' : 'pgvector',
      dialect: status.dialect ?? 'pg',
      allowedLangs: settings.allowedLangs,
    };
  }

  @Get('/settings/audit')
  async auditLogs() {
    return this.audit.listAuditLogs();
  }

  @Get('/unmatched')
  async unmatchedQueries(@Query('limit') limit?: string) {
    return this.unmatched.list(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('/unmatched/count')
  async unmatchedCount() {
    return this.unmatched.count();
  }

  @Post('/unmatched/:id/map')
  async mapUnmatched(
    @Params('id') id: string,
    @Body() body: { toolName?: string; lang?: string },
    @User() user: any,
  ) {
    const entry = await this.unmatched.get(id);
    if (!entry) HttpError.notFound(`Unmatched query not found: ${id}`);
    if (!body.toolName?.trim()) HttpError.badRequest('toolName is required');
    const semantic = await this.semantics.createSemantic({
      toolName: body.toolName.trim(),
      phrase: entry.query,
      lang: body.lang ?? 'und',
    });
    await this.unmatched.resolve(id);
    await this.audit.recordAudit('map_unmatched_query', `${entry.query}->${body.toolName}`, user?.id ?? null);
    return { semantic, deleted: true };
  }

  @Delete('/unmatched/:id')
  async discardUnmatched(@Params('id') id: string, @User() user: any) {
    const result = await this.unmatched.discard(id);
    await this.audit.recordAudit('discard_unmatched_query', `id=${id}`, user?.id ?? null);
    return result;
  }

  @Post('/reindex')
  async reindexAll(@User() user: any) {
    const result = await this.semantics.indexTools();
    await this.audit.recordAudit('reindex_all', 'Full reindex', user?.id ?? null);
    return result;
  }
}
