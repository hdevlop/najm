import { Controller, Get, Post, Patch, Delete, Params, Body, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { LabelService } from '../services/LabelService';
import { StudioAuditService } from './StudioAuditService';
import { CreateLabelDto } from '../dto';

@Controller('/wa-studio/labels')
@isAdmin()
export class LabelController {
  @Inject(LabelService) private labels!: LabelService;
  @Inject(StudioAuditService) private audit!: StudioAuditService;

  @Get('/:instanceId')
  async list(@Params('instanceId') instanceId: string) {
    return this.labels.list(instanceId);
  }

  @Post('/:instanceId')
  @Validate(CreateLabelDto)
  async create(
    @Params('instanceId') instanceId: string,
    @Body() dto: CreateLabelDto,
  ) {
    const label = await this.labels.create(instanceId, dto.name, dto.color);
    this.audit.log('label.create', { instanceId, labelId: label?.id, name: dto.name });
    return label;
  }

  @Patch('/:instanceId/:labelId')
  async update(
    @Params('instanceId') instanceId: string,
    @Params('labelId') labelId: string,
    @Body() body: any,
  ) {
    const label = await this.labels.update(instanceId, labelId, {
      name: body.name,
      color: body.color,
    });
    this.audit.log('label.update', { instanceId, labelId });
    return label;
  }

  @Delete('/:instanceId/:labelId')
  async remove(
    @Params('instanceId') instanceId: string,
    @Params('labelId') labelId: string,
  ) {
    await this.labels.delete(instanceId, labelId);
    this.audit.log('label.delete', { instanceId, labelId });
    return { success: true };
  }

  @Post('/:instanceId/:jid')
  async addChatLabel(
    @Params('instanceId') instanceId: string,
    @Params('jid') jid: string,
    @Body('labelId') labelId: string,
  ) {
    return this.labels.addChatLabel(instanceId, jid, labelId);
  }

  @Post('/:instanceId/:jid/remove')
  async removeChatLabel(
    @Params('instanceId') instanceId: string,
    @Params('jid') jid: string,
    @Body('labelId') labelId: string,
  ) {
    return this.labels.removeChatLabel(instanceId, jid, labelId);
  }
}
