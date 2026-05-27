import 'reflect-metadata';
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { GroupService } from '../../src/services/GroupService';

// ── Mock BaileysAdapter ──────────────────────────────────────────────────

const mockAdapter = {
  createGroup: jest.fn().mockResolvedValue({ id: 'group-jid', subject: 'Test' }),
  groupMetadata: jest.fn().mockResolvedValue({ id: 'group-jid', subject: 'Test', participants: [] }),
  updateGroupSubject: jest.fn().mockResolvedValue(undefined),
  updateGroupDescription: jest.fn().mockResolvedValue(undefined),
  groupParticipantsUpdate: jest.fn().mockResolvedValue([]),
  groupSettingUpdate: jest.fn().mockResolvedValue(undefined),
  groupLeave: jest.fn().mockResolvedValue(undefined),
  groupInviteCode: jest.fn().mockResolvedValue('abc123'),
  groupRevokeInvite: jest.fn().mockResolvedValue(undefined),
  groupFetchAllParticipating: jest.fn().mockResolvedValue([]),
};

// ── Mock BaileysInstance ─────────────────────────────────────────────────

const mockInstance = {
  getAdapter: jest.fn().mockReturnValue(mockAdapter),
};

// ── Mock InstanceManager ─────────────────────────────────────────────────

const mockInstanceManager = {
  getInstance: jest.fn().mockReturnValue(mockInstance),
};

// ── Helper ───────────────────────────────────────────────────────────────

function makeService() {
  const svc = new GroupService();
  (svc as any).instances = mockInstanceManager;
  return svc;
}

const IID = 'inst-1';
const GJID = '123456@g.us';

describe('GroupService', () => {
  let service: GroupService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  test('create() delegates to adapter.createGroup', async () => {
    const result = await service.create(IID, 'My Group', ['55119@s.whatsapp.net', '55229@s.whatsapp.net']);
    expect(mockInstanceManager.getInstance).toHaveBeenCalledWith(IID);
    expect(mockAdapter.createGroup).toHaveBeenCalledWith('My Group', ['55119@s.whatsapp.net', '55229@s.whatsapp.net']);
    expect(result as any).toEqual({ id: 'group-jid', subject: 'Test' });
  });

  test('metadata() delegates to adapter.groupMetadata', async () => {
    const result = await service.metadata(IID, GJID);
    expect(mockAdapter.groupMetadata).toHaveBeenCalledWith(GJID);
    expect(result as any).toEqual({ id: 'group-jid', subject: 'Test', participants: [] });
  });

  test('updateSubject() delegates to adapter.updateGroupSubject', async () => {
    await service.updateSubject(IID, GJID, 'New Subject');
    expect(mockAdapter.updateGroupSubject).toHaveBeenCalledWith(GJID, 'New Subject');
  });

  test('updateDescription() delegates to adapter.updateGroupDescription', async () => {
    await service.updateDescription(IID, GJID, 'A new description');
    expect(mockAdapter.updateGroupDescription).toHaveBeenCalledWith(GJID, 'A new description');
  });

  test('updateDescription() passes undefined when no description', async () => {
    await service.updateDescription(IID, GJID);
    expect(mockAdapter.updateGroupDescription).toHaveBeenCalledWith(GJID, undefined);
  });

  test('participantsUpdate() delegates to adapter.groupParticipantsUpdate with action', async () => {
    const participants = ['55119@s.whatsapp.net'];
    await service.participantsUpdate(IID, GJID, participants, 'add');
    expect(mockAdapter.groupParticipantsUpdate).toHaveBeenCalledWith(GJID, participants, 'add');
  });

  test('participantsUpdate() supports promote action', async () => {
    const participants = ['55119@s.whatsapp.net'];
    await service.participantsUpdate(IID, GJID, participants, 'promote');
    expect(mockAdapter.groupParticipantsUpdate).toHaveBeenCalledWith(GJID, participants, 'promote');
  });

  test('settingUpdate() delegates to adapter.groupSettingUpdate with exactly 2 args', async () => {
    await service.settingUpdate(IID, GJID, 'announcement');
    expect(mockAdapter.groupSettingUpdate).toHaveBeenCalledWith(GJID, 'announcement');
    expect(mockAdapter.groupSettingUpdate.mock.calls[0].length).toBe(2);
  });

  test('settingUpdate() supports all setting values', async () => {
    const settings = ['announcement', 'not_announcement', 'locked', 'unlocked'] as const;
    for (const setting of settings) {
      await service.settingUpdate(IID, GJID, setting);
    }
    expect(mockAdapter.groupSettingUpdate).toHaveBeenCalledTimes(4);
    expect(mockAdapter.groupSettingUpdate).toHaveBeenNthCalledWith(1, GJID, 'announcement');
    expect(mockAdapter.groupSettingUpdate).toHaveBeenNthCalledWith(2, GJID, 'not_announcement');
    expect(mockAdapter.groupSettingUpdate).toHaveBeenNthCalledWith(3, GJID, 'locked');
    expect(mockAdapter.groupSettingUpdate).toHaveBeenNthCalledWith(4, GJID, 'unlocked');
  });

  test('leave() delegates to adapter.groupLeave', async () => {
    await service.leave(IID, GJID);
    expect(mockAdapter.groupLeave).toHaveBeenCalledWith(GJID);
  });

  test('inviteCode() delegates to adapter.groupInviteCode', async () => {
    const result = await service.inviteCode(IID, GJID);
    expect(mockAdapter.groupInviteCode).toHaveBeenCalledWith(GJID);
    expect(result).toBe('abc123');
  });

  test('revokeInvite() delegates to adapter.groupRevokeInvite', async () => {
    await service.revokeInvite(IID, GJID);
    expect(mockAdapter.groupRevokeInvite).toHaveBeenCalledWith(GJID);
  });

  test('fetchAllParticipating() delegates to adapter.groupFetchAllParticipating', async () => {
    const result = await service.fetchAllParticipating(IID);
    expect(mockAdapter.groupFetchAllParticipating).toHaveBeenCalled();
    expect(result as any).toEqual([]);
  });
});
