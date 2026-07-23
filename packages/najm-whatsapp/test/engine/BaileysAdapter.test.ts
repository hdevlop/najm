import { describe, test, expect, mock } from 'bun:test';
import { BaileysAdapter } from '../../src/engine/BaileysAdapter';

// ── Mock socket factory ──────────────────────────────────────────────────────

function createMockSocket(): any {
  return {
    logger: {},
    updateMediaMessage: mock(() => Promise.resolve()),
    sendMessage: mock((...args: any[]) => Promise.resolve({ key: { remoteJid: args[0] } })),
    readMessages: mock(() => Promise.resolve()),
    chatModify: mock(() => Promise.resolve()),
    groupCreate: mock(() => Promise.resolve({ id: 'group-id' })),
    groupMetadata: mock(() => Promise.resolve({ id: 'group', subject: 'Test' })),
    groupUpdateSubject: mock(() => Promise.resolve()),
    groupUpdateDescription: mock(() => Promise.resolve()),
    groupParticipantsUpdate: mock(() => Promise.resolve([])),
    groupSettingUpdate: mock(() => Promise.resolve()),
    groupLeave: mock(() => Promise.resolve()),
    groupInviteCode: mock(() => Promise.resolve('invite-code')),
    groupRevokeInvite: mock(() => Promise.resolve()),
    groupFetchAllParticipating: mock(() => Promise.resolve({})),
    addChatLabel: mock(() => Promise.resolve()),
    removeChatLabel: mock(() => Promise.resolve()),
    addLabel: mock(() => Promise.resolve()),
    profilePictureUrl: mock(() => Promise.resolve('https://example.com/pic.jpg')),
    getBusinessProfile: mock(() => Promise.resolve({ wid: 'biz-wid' })),
    updateProfileName: mock(() => Promise.resolve()),
    updateProfileStatus: mock(() => Promise.resolve()),
    updateProfilePicture: mock(() => Promise.resolve()),
    removeProfilePicture: mock(() => Promise.resolve()),
    sendPresenceUpdate: mock(() => Promise.resolve()),
    fetchMessageHistory: mock(() => Promise.resolve('request-id-123')),
    onWhatsApp: mock(() => Promise.resolve([{ jid: '123456@s.whatsapp.net', exists: true }])),
    addOrEditContact: mock(() => Promise.resolve()),
    end: mock(() => {}),
    logout: mock(() => Promise.resolve()),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BaileysAdapter', () => {

  // ── Constructor ──────────────────────────────────────────────────────────

  test('getRawSocket returns the underlying WASocket', () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    expect(adapter.getRawSocket()).toBe(sock);
  });

  // ── Messages ─────────────────────────────────────────────────────────────

  test('sendText calls sendMessage with text content', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.sendText('123456@s.whatsapp.net', 'Hello world');
    expect(sock.sendMessage).toHaveBeenCalled();
    const [jid, content] = (sock.sendMessage as any).mock.calls[0];
    expect(jid).toBe('123456@s.whatsapp.net');
    expect(content).toEqual({ text: 'Hello world' });
  });

  test('sendImage calls sendMessage with image content and caption', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.sendImage('123456@s.whatsapp.net', { url: 'https://example.com/img.jpg' }, 'A caption');
    expect(sock.sendMessage).toHaveBeenCalled();
    const [jid, content] = (sock.sendMessage as any).mock.calls[0];
    expect(jid).toBe('123456@s.whatsapp.net');
    expect(content.image).toEqual({ url: 'https://example.com/img.jpg' });
    expect(content.caption).toBe('A caption');
  });

  test('sendVideo calls sendMessage with video content and caption', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.sendVideo('123456@s.whatsapp.net', { url: 'https://example.com/vid.mp4' }, 'Video');
    expect(sock.sendMessage).toHaveBeenCalled();
    const [jid, content] = (sock.sendMessage as any).mock.calls[0];
    expect(jid).toBe('123456@s.whatsapp.net');
    expect(content.video).toEqual({ url: 'https://example.com/vid.mp4' });
    expect(content.caption).toBe('Video');
  });

  test('sendAudio calls sendMessage with audio content and ptt flag', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.sendAudio('123456@s.whatsapp.net', { url: 'https://example.com/audio.ogg' }, true);
    expect(sock.sendMessage).toHaveBeenCalled();
    const [jid, content] = (sock.sendMessage as any).mock.calls[0];
    expect(jid).toBe('123456@s.whatsapp.net');
    expect(content.audio).toEqual({ url: 'https://example.com/audio.ogg' });
    expect(content.ptt).toBe(true);
  });

  test('sendDocument calls sendMessage with document content and mimetype', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.sendDocument('123456@s.whatsapp.net', { url: 'https://example.com/doc.pdf' }, 'application/pdf', 'Report.pdf');
    expect(sock.sendMessage).toHaveBeenCalled();
    const [jid, content] = (sock.sendMessage as any).mock.calls[0];
    expect(jid).toBe('123456@s.whatsapp.net');
    expect(content.document).toEqual({ url: 'https://example.com/doc.pdf' });
    expect(content.mimetype).toBe('application/pdf');
    expect(content.fileName).toBe('Report.pdf');
  });

  test('sendLocation calls sendMessage with location content', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.sendLocation('123456@s.whatsapp.net', 40.7128, -74.006, 'NYC', '123 Broadway');
    expect(sock.sendMessage).toHaveBeenCalled();
    const [jid, content] = (sock.sendMessage as any).mock.calls[0];
    expect(jid).toBe('123456@s.whatsapp.net');
    expect(content.location.degreesLatitude).toBe(40.7128);
    expect(content.location.degreesLongitude).toBe(-74.006);
    expect(content.location.name).toBe('NYC');
    expect(content.location.address).toBe('123 Broadway');
  });

  test('sendContact calls sendMessage with vcard contacts', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.sendContact('123456@s.whatsapp.net', { fullName: 'John Doe', phone: '15551234567' });
    expect(sock.sendMessage).toHaveBeenCalled();
    const call = (sock.sendMessage as any).mock.calls[0];
    expect(call[0]).toBe('123456@s.whatsapp.net');
    expect(call[1].contacts.displayName).toBe('John Doe');
    expect(typeof call[1].contacts.contacts[0].vcard).toBe('string');
    expect(call[1].contacts.contacts[0].vcard).toContain('waid=15551234567');
  });

  test('readMessages delegates to socket.readMessages', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const keys = [{ remoteJid: '123456@s.whatsapp.net', id: 'msg-1' }];
    await adapter.readMessages(keys as any);
    expect(sock.readMessages).toHaveBeenCalledWith(keys);
  });

  // ── Chat modifications ─────────────────────────────────────────────────────

  test('archiveChat calls chatModify with { archive, lastMessages }', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const lastMessages = [{ key: { remoteJid: 'test' }, message: {} }];
    await adapter.archiveChat('123456@s.whatsapp.net', true, lastMessages);
    expect(sock.chatModify).toHaveBeenCalledWith(
      { archive: true, lastMessages },
      '123456@s.whatsapp.net',
    );
  });

  test('pinChat calls chatModify with { pin } ONLY — no lastMessages', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.pinChat('123456@s.whatsapp.net', true);
    expect(sock.chatModify).toHaveBeenCalledWith({ pin: true }, '123456@s.whatsapp.net');
    const call = (sock.chatModify as any).mock.calls[0];
    expect(Object.keys(call[0])).not.toContain('lastMessages');
  });

  test('muteChat calls chatModify with { mute }', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.muteChat('123456@s.whatsapp.net', 3600);
    expect(sock.chatModify).toHaveBeenCalledWith({ mute: 3600 }, '123456@s.whatsapp.net');
  });

  test('clearChat calls chatModify with { clear: true, lastMessages }', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const lastMessages = [{ key: { remoteJid: 'test' }, message: {} }];
    await adapter.clearChat('123456@s.whatsapp.net', lastMessages);
    expect(sock.chatModify).toHaveBeenCalledWith(
      { clear: true, lastMessages },
      '123456@s.whatsapp.net',
    );
  });

  test('deleteChat calls chatModify with { delete: true, lastMessages }', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const lastMessages = [{ key: { remoteJid: 'test' }, message: {} }];
    await adapter.deleteChat('123456@s.whatsapp.net', lastMessages);
    expect(sock.chatModify).toHaveBeenCalledWith(
      { delete: true, lastMessages },
      '123456@s.whatsapp.net',
    );
  });

  test('markRead calls chatModify with { markRead: true, lastMessages }', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const lastMessages = [{ key: { remoteJid: 'test' }, message: {} }];
    await adapter.markRead('123456@s.whatsapp.net', lastMessages);
    expect(sock.chatModify).toHaveBeenCalledWith(
      { markRead: true, lastMessages },
      '123456@s.whatsapp.net',
    );
  });

  test('starMessages calls chatModify with { star: { messages, star } }', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const messages = [{ id: 'msg-1', fromMe: false }];
    await adapter.starMessages('123456@s.whatsapp.net', messages, true);
    expect(sock.chatModify).toHaveBeenCalledWith(
      { star: { messages, star: true } },
      '123456@s.whatsapp.net',
    );
  });

  // ── Groups ──────────────────────────────────────────────────────────────────

  test('createGroup delegates to socket.groupCreate', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.createGroup('Test Group', ['5551234567@s.whatsapp.net']);
    expect(sock.groupCreate).toHaveBeenCalledWith('Test Group', ['5551234567@s.whatsapp.net']);
  });

  test('groupMetadata delegates to socket.groupMetadata', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.groupMetadata('123456@s.whatsapp.net');
    expect(sock.groupMetadata).toHaveBeenCalledWith('123456@s.whatsapp.net');
  });

  test('updateGroupSubject delegates to socket.groupUpdateSubject', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.updateGroupSubject('123456@s.whatsapp.net', 'New Subject');
    expect(sock.groupUpdateSubject).toHaveBeenCalledWith('123456@s.whatsapp.net', 'New Subject');
  });

  test('updateGroupDescription delegates to socket.groupUpdateDescription', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.updateGroupDescription('123456@s.whatsapp.net', 'A description');
    expect(sock.groupUpdateDescription).toHaveBeenCalledWith('123456@s.whatsapp.net', 'A description');
  });

  test('groupParticipantsUpdate delegates to socket.groupParticipantsUpdate', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.groupParticipantsUpdate('123456@s.whatsapp.net', ['5551112222@s.whatsapp.net'], 'add');
    expect(sock.groupParticipantsUpdate).toHaveBeenCalledWith(
      '123456@s.whatsapp.net',
      ['5551112222@s.whatsapp.net'],
      'add',
    );
  });

  test('groupSettingUpdate is called with exactly (jid, setting) — no third arg', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.groupSettingUpdate('123456@s.whatsapp.net', 'announcement');
    expect(sock.groupSettingUpdate).toHaveBeenCalledTimes(1);
    expect((sock.groupSettingUpdate as any).mock.calls[0].length).toBe(2);
    expect((sock.groupSettingUpdate as any).mock.calls[0][0]).toBe('123456@s.whatsapp.net');
    expect((sock.groupSettingUpdate as any).mock.calls[0][1]).toBe('announcement');
  });

  test('groupSettingUpdate accepts all four setting values', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const settings = ['announcement', 'not_announcement', 'locked', 'unlocked'] as const;
    for (const setting of settings) {
      await adapter.groupSettingUpdate('123456@s.whatsapp.net', setting);
    }
    expect(sock.groupSettingUpdate).toHaveBeenCalledTimes(4);
  });

  test('groupLeave delegates to socket.groupLeave', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.groupLeave('123456@s.whatsapp.net');
    expect(sock.groupLeave).toHaveBeenCalledWith('123456@s.whatsapp.net');
  });

  test('groupInviteCode delegates to socket.groupInviteCode and returns string', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const result = await adapter.groupInviteCode('123456@s.whatsapp.net');
    expect(sock.groupInviteCode).toHaveBeenCalledWith('123456@s.whatsapp.net');
    expect(typeof result).toBe('string');
    expect(result).toBe('invite-code');
  });

  test('groupRevokeInvite delegates to socket.groupRevokeInvite', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.groupRevokeInvite('123456@s.whatsapp.net');
    expect(sock.groupRevokeInvite).toHaveBeenCalledWith('123456@s.whatsapp.net');
  });

  test('groupFetchAllParticipating delegates to socket.groupFetchAllParticipating', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.groupFetchAllParticipating();
    expect(sock.groupFetchAllParticipating).toHaveBeenCalledTimes(1);
  });

  // ── Labels ─────────────────────────────────────────────────────────────────

  test('addChatLabel delegates to socket.addChatLabel', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.addChatLabel('123456@s.whatsapp.net', 'label-1');
    expect(sock.addChatLabel).toHaveBeenCalledWith('123456@s.whatsapp.net', 'label-1');
  });

  test('removeChatLabel delegates to socket.removeChatLabel', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.removeChatLabel('123456@s.whatsapp.net', 'label-1');
    expect(sock.removeChatLabel).toHaveBeenCalledWith('123456@s.whatsapp.net', 'label-1');
  });

  test('addLabel delegates to socket.addLabel', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.addLabel('123456@s.whatsapp.net', ['label-1']);
    expect(sock.addLabel).toHaveBeenCalledWith('123456@s.whatsapp.net', ['label-1']);
  });

  // ── Profile ─────────────────────────────────────────────────────────────────

  test('profilePictureUrl delegates to socket.profilePictureUrl', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const result = await adapter.profilePictureUrl('123456@s.whatsapp.net', 'image');
    expect(sock.profilePictureUrl).toHaveBeenCalledWith('123456@s.whatsapp.net', 'image');
    expect(result).toBe('https://example.com/pic.jpg');
  });

  test('profilePictureUrl defaults type to undefined', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.profilePictureUrl('123456@s.whatsapp.net');
    expect(sock.profilePictureUrl).toHaveBeenCalledWith('123456@s.whatsapp.net', undefined);
  });

  test('getBusinessProfile delegates to socket.getBusinessProfile', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.getBusinessProfile('123456@s.whatsapp.net');
    expect(sock.getBusinessProfile).toHaveBeenCalledWith('123456@s.whatsapp.net');
  });

  test('updateProfileName delegates to socket.updateProfileName', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.updateProfileName('New Name');
    expect(sock.updateProfileName).toHaveBeenCalledWith('New Name');
  });

  test('updateProfileStatus delegates to socket.updateProfileStatus', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.updateProfileStatus('Hello world');
    expect(sock.updateProfileStatus).toHaveBeenCalledWith('Hello world');
  });

  test('updateProfilePicture delegates to socket.updateProfilePicture', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const buffer = Buffer.from('fake-image-data');
    await adapter.updateProfilePicture('123456@s.whatsapp.net', buffer);
    expect(sock.updateProfilePicture).toHaveBeenCalledWith('123456@s.whatsapp.net', buffer);
  });

  test('removeProfilePicture delegates to socket.removeProfilePicture', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.removeProfilePicture('123456@s.whatsapp.net');
    expect(sock.removeProfilePicture).toHaveBeenCalledWith('123456@s.whatsapp.net');
  });

  test('sendPresenceUpdate delegates to socket.sendPresenceUpdate', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.sendPresenceUpdate('available', '123456@s.whatsapp.net');
    expect(sock.sendPresenceUpdate).toHaveBeenCalledWith('available', '123456@s.whatsapp.net');
  });

  // ── History & Media ─────────────────────────────────────────────────────────

  test('fetchMessageHistory delegates to socket.fetchMessageHistory and returns a string', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const oldestMsgKey = { remoteJid: '123456@s.whatsapp.net', id: 'msg-oldest', fromMe: false };
    const result = await adapter.fetchMessageHistory(50, oldestMsgKey as any, 1710000000);
    expect(sock.fetchMessageHistory).toHaveBeenCalledWith(50, oldestMsgKey, 1710000000);
    expect(typeof result).toBe('string');
    expect(result).toBe('request-id-123');
  });

  // ── Contacts ────────────────────────────────────────────────────────────────

  test('onWhatsApp delegates to socket.onWhatsApp', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.onWhatsApp('15551234567');
    expect(sock.onWhatsApp).toHaveBeenCalledWith('15551234567');
  });

  test('addOrEditContact delegates to socket.addOrEditContact', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    const contact = { id: '123456@s.whatsapp.net', name: 'John' };
    await adapter.addOrEditContact('123456@s.whatsapp.net', contact);
    expect(sock.addOrEditContact).toHaveBeenCalledWith('123456@s.whatsapp.net', contact);
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  test('end delegates to socket.end', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.end();
    expect(sock.end).toHaveBeenCalled();
  });

  test('logout delegates to socket.logout with message', async () => {
    const sock = createMockSocket();
    const adapter = new BaileysAdapter(sock);
    await adapter.logout('bye');
    expect(sock.logout).toHaveBeenCalledWith('bye');
  });

});