import { Body, Get, Post } from 'najm-api';
import { I18n } from 'najm-i18n';
import { Controller } from 'najm-api';
import { Validate } from 'najm-validation';
import { McpTool, ToolGroup } from 'najm-mcp';
import { z } from 'zod';
import { SummaryService } from './SummaryService';

const echoDto = z.object({ text: z.string() });

@ToolGroup('health')
@Controller('/health')
export class HealthController {
  constructor(private summaryService: SummaryService) {}

  @I18n() private t!: (key: string, params?: any) => string;

  @Get('/')
  @McpTool({ description: 'Check playground API health', readOnly: true })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: this.t('common.success'),
    };
  }

  @Get('/lang')
  @McpTool({ description: 'Inspect translated health-related messages', readOnly: true })
  langCheck() {
    return {
      unauthorized: this.t('common.unauthorized'),
      forbidden: this.t('common.forbidden'),
      notFound: this.t('common.notFound'),
    };
  }

  @Get('/summary')
  @McpTool({ description: 'Get a quick summary of playground data and service health', readOnly: true })
  async summary() {
    return this.summaryService.summary();
  }

  @Post('/echo')
  @McpTool({ description: 'Echo text for MCP connectivity checks' })
  @Validate(echoDto)
  echo(@Body() body: { text: string }) {
    return { text: body.text };
  }
}
