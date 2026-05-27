import { Controller, Get, Post, Params, Body, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { AiResponderService } from '../services/AiResponderService';
import { StudioAuditService } from './StudioAuditService';
import { SaveAiConfigDto } from '../dto';

@Controller('/wa-studio/ai-config')
@isAdmin()
export class AiConfigController {
  @Inject(AiResponderService) private service!: AiResponderService;
  @Inject(StudioAuditService) private audit!: StudioAuditService;

  @Get('/:instanceId')
  async get(@Params('instanceId') instanceId: string) {
    const config = await this.service.getConfig(instanceId);
    return config ?? {
      instanceId,
      enabled: false,
      provider: null,
      model: null,
      systemPrompt: null,
      temperature: null,
    };
  }

  @Post('/:instanceId')
  @Validate(SaveAiConfigDto)
  async save(
    @Params('instanceId') instanceId: string,
    @Body() dto: SaveAiConfigDto,
  ) {
    const config = await this.service.upsertConfig({
      instanceId,
      enabled: dto.enabled,
      provider: dto.provider,
      model: dto.model,
      systemPrompt: dto.systemPrompt,
      temperature: dto.temperature,
    });
    await this.audit.log('ai-config.save', { instanceId, enabled: config.enabled });
    return config;
  }
}
