import { Service, Meta, Inject } from 'najm-core';
import { InstanceManager } from '../engine/InstanceManager';

@Service()
@Meta({ layer: 'plugin' })
export class GroupService {
  @Inject(InstanceManager) private instances!: InstanceManager;

  async create(instanceId: string, subject: string, participants: string[]) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.createGroup(subject, participants);
  }

  async metadata(instanceId: string, jid: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.groupMetadata(jid);
  }

  async updateSubject(instanceId: string, jid: string, subject: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.updateGroupSubject(jid, subject);
  }

  async updateDescription(instanceId: string, jid: string, description?: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.updateGroupDescription(jid, description);
  }

  async participantsUpdate(
    instanceId: string,
    jid: string,
    participants: string[],
    action: 'add' | 'remove' | 'promote' | 'demote',
  ) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.groupParticipantsUpdate(jid, participants, action);
  }

  async settingUpdate(
    instanceId: string,
    jid: string,
    setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked',
  ) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.groupSettingUpdate(jid, setting);
  }

  async leave(instanceId: string, jid: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.groupLeave(jid);
  }

  async inviteCode(instanceId: string, jid: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.groupInviteCode(jid);
  }

  async revokeInvite(instanceId: string, jid: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.groupRevokeInvite(jid);
  }

  async fetchAllParticipating(instanceId: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.groupFetchAllParticipating();
  }
}
