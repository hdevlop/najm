import { Controller, Get, Post, Params, Body, Query, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { ContactService } from '../services/ContactService';
import { ContactDto } from '../dto';

@Controller('/wa-studio/contacts')
@isAdmin()
export class ContactController {
  @Inject(ContactService) private contacts!: ContactService;

  @Get('/:instanceId')
  async list(
    @Params('instanceId') instanceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.contacts.list(instanceId, Number(limit ?? 100), Number(offset ?? 0));
  }

  @Post('/:instanceId')
  @Validate(ContactDto)
  async addOrEdit(@Params('instanceId') instanceId: string, @Body() dto: ContactDto) {
    return this.contacts.addOrEdit(instanceId, dto.jid, dto);
  }
}
