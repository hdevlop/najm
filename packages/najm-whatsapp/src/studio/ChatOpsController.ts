import { Controller, Post, Body, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { ChatOpsService } from '../services/ChatOpsService';
import { ChatOpsDto, MuteDto } from '../dto';
import { StudioAuditService } from './StudioAuditService';

@Controller('/wa-studio/chat-ops')
@isAdmin()
export class ChatOpsController {
  @Inject(ChatOpsService) private chatOps!: ChatOpsService;
  @Inject(StudioAuditService) private audit!: StudioAuditService;

  @Post('/archive')
  @Validate(ChatOpsDto)
  async archive(@Body() dto: ChatOpsDto) {
    await this.chatOps.archiveChat(dto.instanceId, dto.jid, dto.archive ?? true);
    await this.audit.log('chatops.archive', { instanceId: dto.instanceId, jid: dto.jid });
    return { success: true };
  }

  @Post('/pin')
  @Validate(ChatOpsDto)
  async pin(@Body() dto: ChatOpsDto) {
    await this.chatOps.pinChat(dto.instanceId, dto.jid, dto.pin ?? true);
    await this.audit.log('chatops.pin', { instanceId: dto.instanceId, jid: dto.jid });
    return { success: true };
  }

  @Post('/mute')
  @Validate(MuteDto)
  async mute(@Body() dto: MuteDto) {
    await this.chatOps.muteChat(dto.instanceId, dto.jid, dto.duration ?? null);
    await this.audit.log('chatops.mute', { instanceId: dto.instanceId, jid: dto.jid });
    return { success: true };
  }

  @Post('/delete')
  @Validate(ChatOpsDto)
  async delete(@Body() dto: ChatOpsDto) {
    await this.chatOps.deleteChat(dto.instanceId, dto.jid);
    await this.audit.log('chatops.delete', { instanceId: dto.instanceId, jid: dto.jid });
    return { success: true };
  }

  @Post('/read')
  @Validate(ChatOpsDto)
  async markRead(@Body() dto: ChatOpsDto) {
    await this.chatOps.markRead(dto.instanceId, dto.jid);
    await this.audit.log('chatops.read', { instanceId: dto.instanceId, jid: dto.jid });
    return { success: true };
  }
}
