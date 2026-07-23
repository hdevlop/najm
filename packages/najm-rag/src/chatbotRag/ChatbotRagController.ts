import { Controller, Get, Post, Patch, Delete, Body, Params, Query, FormData as FormDataParam, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdministrator } from 'najm-auth';
import { ChatbotRagValidator } from './ChatbotRagValidator';
import { SemanticPhraseService } from './SemanticPhraseService';
import { ToolMetadataService } from './ToolMetadataService';
import { KnowledgeDocumentService } from '../knowledge/KnowledgeDocumentService';
import { ToolIndexerService } from '../toolIndex/ToolIndexerService';
import { ToolRouterService } from '../toolRouter/ToolRouterService';
import { RoutingSettingsService } from '../routingSettings/RoutingSettingsService';
import { updateRoutingSettingsSchema } from '../routingSettings/RoutingSettingsDto';
import {
  importSemanticsDto,
  createSemanticDto,
  updateSemanticDto,
  previewRoutingDto,
  knowledgeSearchDto,
  ingestTextDto,
  type ImportSemanticsDto,
  type CreateSemanticDto,
  type UpdateSemanticDto,
  type PreviewRoutingDto,
  type KnowledgeSearchDto,
  type IngestTextDto,
} from '../chatbotRag/ChatbotRagDto';

@Controller('/chatbot-rag')
export class ChatbotRagController {
  @Inject() private semantics!: SemanticPhraseService;
  @Inject() private tools!: ToolMetadataService;
  @Inject() private docs!: KnowledgeDocumentService;
  @Inject() private indexer!: ToolIndexerService;
  @Inject() private router!: ToolRouterService;
  @Inject() private settings!: RoutingSettingsService;

  @Get('/status')
  @isAdministrator()
  async status() {
    return this.semantics.getStatus();
  }

  @Post('/index-tools')
  @isAdministrator()
  async indexTools() {
    return this.semantics.indexTools();
  }

  @Get('/semantics')
  @isAdministrator()
  async listSemantics(@Query('toolName') toolName?: string) {
    return this.semantics.listSemantics(toolName);
  }

  @Get('/semantics/export')
  @isAdministrator()
  async exportSemantics() {
    return this.semantics.exportSemantics();
  }

  @Post('/semantics/import')
  @isAdministrator()
  @Validate(importSemanticsDto)
  async importSemantics(@Body() body: ImportSemanticsDto) {
    return this.semantics.importSemantics(body);
  }

  @Post('/semantics/reindex')
  @isAdministrator()
  async reindexSemantics() {
    return this.semantics.reindexSemantics();
  }

  @Get('/semantics/:id')
  @isAdministrator()
  async getSemanticById(@Params('id') id: string) {
    return this.semantics.getSemanticById(id);
  }

  @Post('/semantics')
  @isAdministrator()
  @Validate(createSemanticDto)
  async createSemantic(@Body() body: CreateSemanticDto) {
    return this.semantics.createSemantic(body);
  }

  @Patch('/semantics/:id')
  @isAdministrator()
  @Validate(updateSemanticDto)
  async updateSemantic(@Params('id') id: string, @Body() body: UpdateSemanticDto) {
    return this.semantics.updateSemantic(id, body);
  }

  @Delete('/semantics')
  @isAdministrator()
  async deleteAllSemantics() {
    return this.semantics.deleteAllSemantics();
  }

  @Delete('/semantics/:id')
  @isAdministrator()
  async deleteSemantic(@Params('id') id: string) {
    return this.semantics.deleteSemantic(id);
  }

  @Post('/knowledge/search')
  @isAdministrator()
  @Validate(knowledgeSearchDto)
  async searchKnowledge(@Body() body: KnowledgeSearchDto) {
    const settings = this.settings ? await this.settings.getEffectiveSettings() : null;
    if (settings?.enableKnowledge === false) {
      return { query: body.query, citations: [] };
    }
    return this.docs.searchKnowledge(body.query, body.limit, body.threshold);
  }

  @Post('/knowledge/documents/text')
  @isAdministrator()
  @Validate(ingestTextDto)
  async ingestTextDocument(@Body() body: IngestTextDto) {
    return this.docs.ingestTextDocument(body);
  }

  @Post('/knowledge/documents/upload')
  @isAdministrator()
  async uploadDocument(@FormDataParam() formData: FormData) {
    return this.docs.uploadDocument(formData);
  }

  @Get('/knowledge/documents')
  @isAdministrator()
  async listDocuments(@Query('namespace') namespace?: string) {
    return this.docs.listDocuments(namespace);
  }

  @Get('/knowledge/documents/:id/chunks')
  @isAdministrator()
  async getDocumentChunks(@Params('id') id: string) {
    return this.docs.getDocumentChunks(id);
  }

  @Delete('/knowledge/documents/:id')
  @isAdministrator()
  async deleteDocument(@Params('id') id: string) {
    return this.docs.deleteDocument(id);
  }

  @Post('/knowledge/documents/:id/reindex')
  @isAdministrator()
  async reindexDocument(@Params('id') id: string) {
    return this.docs.reindexDocument(id);
  }

  @Get('/knowledge/status')
  @isAdministrator()
  async getKnowledgeStatus() {
    return this.docs.getKnowledgeStatus();
  }

  @Post('/routing/preview')
  @isAdministrator()
  @Validate(previewRoutingDto)
  async previewRouting(@Body() body: PreviewRoutingDto) {
    return this.semantics.previewRouting(body.query);
  }

  @Get('/tools')
  @isAdministrator()
  async getToolList() {
    return this.tools.getToolList();
  }

  @Post('/tools/:toolName/dependencies')
  @isAdministrator()
  async addToolDependency(@Params('toolName') toolName: string, @Body() body: { dependency: string }) {
    return this.tools.addToolDependency(toolName, body.dependency);
  }

  @Delete('/tools/:toolName/dependencies/:dependencyName')
  @isAdministrator()
  async removeToolDependency(@Params('toolName') toolName: string, @Params('dependencyName') dependencyName: string) {
    return this.tools.removeToolDependency(toolName, dependencyName);
  }

  @Get('/logs/export')
  @isAdministrator()
  async exportLogs() {
    return { message: 'Log export is not implemented in v1. Use direct database access.' };
  }

  @Get('/settings')
  @isAdministrator()
  async getSettings() {
    return this.settings.getEffectiveSettings();
  }

  @Patch('/settings')
  @isAdministrator()
  @Validate(updateRoutingSettingsSchema)
  async updateSettings(@Body() body: any) {
    return this.settings.updateSettings(body);
  }
}
