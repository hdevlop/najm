import 'reflect-metadata';
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { ProfileService } from '../../src/services/ProfileService';

// ── Mock BaileysAdapter ──────────────────────────────────────────────────

const mockAdapter = {
  profilePictureUrl: jest.fn().mockResolvedValue('https://pic.url/thumb'),
  getBusinessProfile: jest.fn().mockResolvedValue({ name: 'Biz' }),
  updateProfileName: jest.fn().mockResolvedValue(undefined),
  updateProfileStatus: jest.fn().mockResolvedValue(undefined),
  updateProfilePicture: jest.fn().mockResolvedValue(undefined),
  removeProfilePicture: jest.fn().mockResolvedValue(undefined),
  sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
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
  const svc = new ProfileService();
  (svc as any).instances = mockInstanceManager;
  return svc;
}

const IID = 'inst-1';
const JID = '55119@s.whatsapp.net';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  test('pictureUrl() delegates to adapter.profilePictureUrl', async () => {
    const result = await service.pictureUrl(IID, JID);
    expect(mockAdapter.profilePictureUrl).toHaveBeenCalledWith(JID, undefined);
    expect(result).toBe('https://pic.url/thumb');
  });

  test('pictureUrl() passes type parameter', async () => {
    await service.pictureUrl(IID, JID, 'preview');
    expect(mockAdapter.profilePictureUrl).toHaveBeenCalledWith(JID, 'preview');
  });

  test('businessProfile() delegates to adapter.getBusinessProfile', async () => {
    const result = await service.businessProfile(IID, JID);
    expect(mockAdapter.getBusinessProfile).toHaveBeenCalledWith(JID);
    expect(result as any).toEqual({ name: 'Biz' });
  });

  test('updateName() delegates to adapter.updateProfileName', async () => {
    await service.updateName(IID, 'New Name');
    expect(mockAdapter.updateProfileName).toHaveBeenCalledWith('New Name');
  });

  test('updateStatus() delegates to adapter.updateProfileStatus', async () => {
    await service.updateStatus(IID, 'Available');
    expect(mockAdapter.updateProfileStatus).toHaveBeenCalledWith('Available');
  });

  test('updatePicture() delegates to adapter.updateProfilePicture', async () => {
    const buffer = Buffer.from('image-data');
    await service.updatePicture(IID, JID, buffer);
    expect(mockAdapter.updateProfilePicture).toHaveBeenCalledWith(JID, buffer);
  });

  test('removePicture() delegates to adapter.removeProfilePicture', async () => {
    await service.removePicture(IID, JID);
    expect(mockAdapter.removeProfilePicture).toHaveBeenCalledWith(JID);
  });

  test('sendPresenceUpdate() delegates to adapter.sendPresenceUpdate without jid', async () => {
    await service.sendPresenceUpdate(IID, 'available');
    expect(mockAdapter.sendPresenceUpdate).toHaveBeenCalledWith('available', undefined);
  });

  test('sendPresenceUpdate() passes optional jid', async () => {
    await service.sendPresenceUpdate(IID, 'composing', JID);
    expect(mockAdapter.sendPresenceUpdate).toHaveBeenCalledWith('composing', JID);
  });
});
