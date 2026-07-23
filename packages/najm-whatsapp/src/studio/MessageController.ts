import { Controller, Get, Post, Params, Body, Query, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { MessageService } from '../engine/MessageService';
import { MessageStoreService } from '../engine/MessageStoreService';
import { SendMessageDto, HistoryRequestDto } from '../dto';
import { StudioAuditService } from './StudioAuditService';

@Controller('/wa-studio/messages')
@isAdmin()
export class MessageController {
  @Inject(MessageService) private messages!: MessageService;
  @Inject(MessageStoreService) private store!: MessageStoreService;
  @Inject(StudioAuditService) private audit!: StudioAuditService;

  @Post('/send')
  @Validate(SendMessageDto)
  async send(@Body() dto: SendMessageDto) {
    const result = await this.messages.sendText(dto.instanceId, dto.jid, dto.text, dto.options);
    await this.audit.log('message.send', { instanceId: dto.instanceId, jid: dto.jid });
    return result;
  }

  @Get('/:instanceId/:jid')
  async list(
    @Params('instanceId') instanceId: string,
    @Params('jid') jid: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.store.getMessages(instanceId, jid, Number(limit ?? 50), Number(offset ?? 0));
  }

  @Post('/history')
  @Validate(HistoryRequestDto)
  async requestHistory(@Body() dto: HistoryRequestDto) {
    return this.messages.requestHistory(dto.instanceId, dto.jid, dto.count);
  }
}
