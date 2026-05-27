import { Controller, Get, Post, Patch, Delete, Body, Params, Query, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { WebhookForwarder } from '../services/WebhookForwarder';
import { WebhookService } from '../services/WebhookService';
import { CreateWebhookDto, TestWebhookDto, UpdateWebhookDto } from '../dto';
import { StudioAuditService } from './StudioAuditService';

@Controller('/wa-studio/webhooks')
@isAdmin()
export class WebhookController {
  @Inject(WebhookService) private webhooks!: WebhookService;
  @Inject(WebhookForwarder) private forwarder!: WebhookForwarder;
  @Inject(StudioAuditService) private audit!: StudioAuditService;

  @Get('/')
  async list(@Query('instanceId') instanceId?: string) {
    return this.webhooks.list(instanceId);
  }

  @Post('/')
  @Validate(CreateWebhookDto)
  async create(@Body() dto: CreateWebhookDto) {
    const wh = await this.webhooks.create(dto);
    this.audit.log('webhook.create', { webhookId: wh.id, url: wh.url });
    return wh;
  }

  @Patch('/:id')
  @Validate(UpdateWebhookDto)
  async update(@Params('id') id: string, @Body() dto: UpdateWebhookDto) {
    const wh = await this.webhooks.update(id, dto);
    if (!wh) return { error: 'not_found' };
    this.audit.log('webhook.update', { webhookId: id });
    return wh;
  }

  @Delete('/:id')
  async remove(@Params('id') id: string) {
    await this.webhooks.delete(id);
    this.audit.log('webhook.delete', { webhookId: id });
    return { success: true };
  }

  @Post('/test')
  @Validate(TestWebhookDto)
  async test(@Body() dto: TestWebhookDto) {
    await this.forwarder.forward(dto.eventType, { test: true });
    this.audit.log('webhook.test', { url: dto.url, eventType: dto.eventType });
    return { success: true };
  }
}
