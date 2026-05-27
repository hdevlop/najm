import { Controller, Get, Post, Patch, Params, Body, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { GroupService } from '../services/GroupService';
import { CreateGroupDto, GroupSettingsDto, UpdateParticipantsDto } from '../dto';
import { StudioAuditService } from './StudioAuditService';

@Controller('/wa-studio/groups')
@isAdmin()
export class GroupController {
  @Inject(GroupService) private groups!: GroupService;
  @Inject(StudioAuditService) private audit!: StudioAuditService;

  @Post('/')
  @Validate(CreateGroupDto)
  async create(@Body() dto: CreateGroupDto) {
    const result = await this.groups.create(dto.instanceId, dto.subject, dto.participants);
    await this.audit.log('group.create', { instanceId: dto.instanceId });
    return result;
  }

  @Get('/:instanceId')
  async list(@Params('instanceId') instanceId: string) {
    return this.groups.fetchAllParticipating(instanceId);
  }

  @Get('/:instanceId/:jid/metadata')
  async metadata(@Params('instanceId') instanceId: string, @Params('jid') jid: string) {
    return this.groups.metadata(instanceId, jid);
  }

  @Post('/:instanceId/:jid/participants')
  @Validate(UpdateParticipantsDto)
  async updateParticipants(
    @Params('instanceId') instanceId: string,
    @Params('jid') jid: string,
    @Body() dto: UpdateParticipantsDto,
  ) {
    return this.groups.participantsUpdate(instanceId, jid, dto.participants, dto.action);
  }

  @Patch('/:instanceId/:jid/settings')
  @Validate(GroupSettingsDto)
  async updateSettings(
    @Params('instanceId') instanceId: string,
    @Params('jid') jid: string,
    @Body() dto: GroupSettingsDto,
  ) {
    return this.groups.settingUpdate(instanceId, jid, dto.setting);
  }
}
