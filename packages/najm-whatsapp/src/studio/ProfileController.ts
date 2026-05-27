import { Controller, Get, Post, Params, Body, Query, Inject } from 'najm-core';
import { isAdmin } from 'najm-auth';
import { ProfileService } from '../services/ProfileService';
import { StudioAuditService } from './StudioAuditService';

@Controller('/wa-studio/profile')
@isAdmin()
export class ProfileController {
  @Inject(ProfileService) private profile!: ProfileService;
  @Inject(StudioAuditService) private audit!: StudioAuditService;

  @Get('/:instanceId/picture')
  async picture(@Params('instanceId') instanceId: string, @Query('jid') jid?: string) {
    const ownJid = jid || instanceId;
    return { url: await this.profile.pictureUrl(instanceId, ownJid) };
  }

  @Post('/:instanceId/picture')
  async updatePicture(@Params('instanceId') instanceId: string, @Body('buffer') buffer: string) {
    const base64 = buffer.includes(',') ? buffer.split(',')[1] : buffer;
    const buf = Buffer.from(base64, 'base64');
    await this.profile.updateOwnPicture(instanceId, buf);
    await this.audit.log('profile.picture', { instanceId });
    return { success: true };
  }

  @Post('/:instanceId/name')
  async updateName(@Params('instanceId') instanceId: string, @Body('name') name: string) {
    await this.profile.updateName(instanceId, name);
    await this.audit.log('profile.name', { instanceId, name });
    return { success: true };
  }

  @Post('/:instanceId/status')
  async updateStatus(@Params('instanceId') instanceId: string, @Body('status') status: string) {
    await this.profile.updateStatus(instanceId, status);
    await this.audit.log('profile.status', { instanceId, status });
    return { success: true };
  }
}
