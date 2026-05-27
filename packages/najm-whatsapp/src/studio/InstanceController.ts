import { Controller, Get, Post, Delete, Params, Body, Inject } from 'najm-core';
import { Validate } from 'najm-validation';
import { DB } from 'najm-database';
import { isAdmin } from 'najm-auth';
import { sql } from 'drizzle-orm';
import { InstanceManager } from '../engine/InstanceManager';
import { StudioAuditService } from './StudioAuditService';
import { CreateInstanceDto } from '../dto';
import { WA_SCHEMA } from '../tokens';
import { randomUUID } from 'crypto';

@Controller('/wa-studio/instances')
@isAdmin()
export class InstanceController {
  @Inject(InstanceManager) private instances!: InstanceManager;
  @Inject(StudioAuditService) private audit!: StudioAuditService;
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  @Get('/')
  async list() {
    const infos = this.instances.list();
    const messages = this.schema?.whatsappMessages;
    const contacts = this.schema?.whatsappContacts;

    const [msgRows, contactRows] = await Promise.all([
      messages
        ? this.db
            .select({ instanceId: messages.instanceId, count: sql<number>`count(*)` })
            .from(messages)
            .groupBy(messages.instanceId)
        : Promise.resolve([] as Array<{ instanceId: string; count: number }>),
      contacts
        ? this.db
            .select({ instanceId: contacts.instanceId, count: sql<number>`count(*)` })
            .from(contacts)
            .groupBy(contacts.instanceId)
        : Promise.resolve([] as Array<{ instanceId: string; count: number }>),
    ]);

    const msgMap = new Map<string, number>(msgRows.map((r: any) => [r.instanceId, Number(r.count)]));
    const contactMap = new Map<string, number>(contactRows.map((r: any) => [r.instanceId, Number(r.count)]));

    return infos.map((info) => ({
      ...info,
      messageCount: msgMap.get(info.id) ?? 0,
      contactCount: contactMap.get(info.id) ?? 0,
    }));
  }

  @Post('/')
  @Validate(CreateInstanceDto)
  async create(@Body() dto: any) {
    const id = dto.id ?? randomUUID();
    const info = await this.instances.create(id, dto.name);
    await this.audit.log('instance.create', { instanceId: id, name: dto.name });
    return info;
  }

  @Post('/:id/connect')
  async connect(@Params('id') id: string) {
    await this.instances.connect(id);
    await this.audit.log('instance.connect', { instanceId: id });
    return { success: true };
  }

  @Post('/:id/disconnect')
  async disconnect(@Params('id') id: string) {
    await this.instances.disconnect(id);
    await this.audit.log('instance.disconnect', { instanceId: id });
    return { success: true };
  }

  @Get('/:id/qr')
  async getQr(@Params('id') id: string) {
    const info = this.instances.getInfo(id);
    if (!info) return { qr: null };
    return { qr: info.qrCode ?? null };
  }

  @Post('/:id/reset-session')
  async resetSession(@Params('id') id: string) {
    await this.instances.resetSession(id);
    await this.audit.log('instance.reset-session', { instanceId: id });
    return { success: true };
  }

  @Delete('/:id')
  async remove(@Params('id') id: string) {
    await this.instances.delete(id);
    await this.audit.log('instance.delete', { instanceId: id });
    return { success: true };
  }
}
