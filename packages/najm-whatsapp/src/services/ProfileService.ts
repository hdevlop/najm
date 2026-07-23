import { Service, Meta, Inject } from 'najm-core';
import { InstanceManager } from '../engine/InstanceManager';

@Service()
@Meta({ layer: 'plugin' })
export class ProfileService {
  @Inject(InstanceManager) private instances!: InstanceManager;

  private getAdapter(instanceId: string) {
    return this.instances.getInstance(instanceId).getAdapter();
  }

  async pictureUrl(instanceId: string, jid: string, type?: 'image' | 'preview') {
    return this.getAdapter(instanceId).profilePictureUrl(jid, type);
  }

  async businessProfile(instanceId: string, jid: string) {
    return this.getAdapter(instanceId).getBusinessProfile(jid);
  }

  async updateName(instanceId: string, name: string) {
    return this.getAdapter(instanceId).updateProfileName(name);
  }

  async updateStatus(instanceId: string, about: string) {
    return this.getAdapter(instanceId).updateProfileStatus(about);
  }

  async updatePicture(instanceId: string, jid: string, buffer: Buffer) {
    return this.getAdapter(instanceId).updateProfilePicture(jid, buffer);
  }

  async updateOwnPicture(instanceId: string, buffer: Buffer) {
    const socket = this.instances.getInstance(instanceId).getAdapter().getRawSocket();
    const ownJid = socket.user?.id;
    if (!ownJid) throw new Error('Unable to determine own JID');
    return this.getAdapter(instanceId).updateProfilePicture(ownJid, buffer);
  }

  async removePicture(instanceId: string, jid: string) {
    return this.getAdapter(instanceId).removeProfilePicture(jid);
  }

  async sendPresenceUpdate(instanceId: string, type: string, jid?: string) {
    return this.getAdapter(instanceId).sendPresenceUpdate(type, jid);
  }
}
