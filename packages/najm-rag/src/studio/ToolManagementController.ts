import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Params,
  Inject,
  User,
} from 'najm-core';
import { isAdmin } from 'najm-auth';
import { McpTool, ToolGroup } from 'najm-mcp';
import { SemanticPhraseService } from '../chatbotRag/SemanticPhraseService';
import { ToolMetadataService } from '../chatbotRag/ToolMetadataService';
import { StudioAuditService } from './StudioAuditService';

@Controller('/rag-studio')
@ToolGroup('rag_studio')
@isAdmin()
export class ToolManagementController {
  @Inject() private semantics!: SemanticPhraseService;
  @Inject() private toolMetadata!: ToolMetadataService;
  @Inject() private audit!: StudioAuditService;

  @Get('/tools')
  async toolsStatus() {
    const s = await this.semantics.getStatus();
    return {
      indexed: s.indexedToolCount,
      registered: s.registeredToolCount,
    };
  }

  @Get('/tools/list')
  @McpTool('List all registered tools with metadata (group, description, schema) — useful as input when generating semantic phrases')
  async toolList() {
    return this.toolMetadata.getToolList();
  }

  @Post('/tools/reindex')
  @McpTool('Reindex all tools (regenerate embeddings for tool metadata)')
  async reindexTools(@User() user: any) {
    const result = await this.semantics.indexTools();
    await this.audit.recordAudit('reindex_tools', 'Reindex all tools', user?.id ?? null);
    return result;
  }

  @Post('/tools/:toolName/dependencies')
  async addToolDependency(
    @Params('toolName') toolName: string,
    @Body() body: { dependency?: string },
    @User() user: any,
  ) {
    const result = await this.toolMetadata.addToolDependency(decodeURIComponent(toolName), body.dependency ?? '');
    await this.audit.recordAudit('add_tool_dependency', `${toolName}->${body.dependency}`, user?.id ?? null);
    return result;
  }

  @Delete('/tools/:toolName/dependencies/:dependencyName')
  async removeToolDependency(
    @Params('toolName') toolName: string,
    @Params('dependencyName') dependencyName: string,
    @User() user: any,
  ) {
    const result = await this.toolMetadata.removeToolDependency(
      decodeURIComponent(toolName),
      decodeURIComponent(dependencyName),
    );
    await this.audit.recordAudit('remove_tool_dependency', `${toolName}->${dependencyName}`, user?.id ?? null);
    return result;
  }
}
