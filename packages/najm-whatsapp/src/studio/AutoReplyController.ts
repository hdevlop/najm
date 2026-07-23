import { Controller, Get, Post, Patch, Delete, Params, Body, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { AutoReplyService } from '../services/AutoReplyService';
import { StudioAuditService } from './StudioAuditService';
import { CreateAutoReplyRuleDto, UpdateAutoReplyRuleDto } from '../dto';

@Controller('/wa-studio/auto-reply')
@isAdmin()
export class AutoReplyController {
  @Inject(AutoReplyService) private service!: AutoReplyService;
  @Inject(StudioAuditService) private audit!: StudioAuditService;

  @Get('/:instanceId')
  async list(@Params('instanceId') instanceId: string) {
    return this.service.listRules(instanceId);
  }

  @Post('/:instanceId')
  @Validate(CreateAutoReplyRuleDto)
  async create(
    @Params('instanceId') instanceId: string,
    @Body() dto: CreateAutoReplyRuleDto,
  ) {
    const rule = await this.service.createRule({
      instanceId,
      pattern: dto.pattern,
      response: dto.response,
      matchType: dto.matchType || 'exact',
      enabled: dto.enabled ?? true,
    });
    await this.audit.log('auto-reply.create', { instanceId, ruleId: rule.id, pattern: dto.pattern });
    return rule;
  }

  @Patch('/:instanceId/:id')
  @Validate(UpdateAutoReplyRuleDto)
  async update(
    @Params('instanceId') instanceId: string,
    @Params('id') id: string,
    @Body() dto: UpdateAutoReplyRuleDto,
  ) {
    const rule = await this.service.updateRule(instanceId, id, dto);
    await this.audit.log('auto-reply.update', { instanceId, ruleId: id });
    return rule;
  }

  @Delete('/:instanceId/:id')
  async remove(
    @Params('instanceId') instanceId: string,
    @Params('id') id: string,
  ) {
    await this.service.deleteRule(instanceId, id);
    await this.audit.log('auto-reply.delete', { instanceId, ruleId: id });
    return { success: true };
  }
}
