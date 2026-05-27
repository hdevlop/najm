/**
 * BaileysAdapter — thin wrapper around WASocket from @whiskeysockets/baileys.
 *
 * Centralizes all socket method calls so that:
 * 1. Typing is explicit.
 * 2. Known Baileys quirks are corrected in one place.
 * 3. The adapter can be mocked in higher-level tests.
 *
 * IMPORTANT method shapes (verified against baileys v6.17.16):
 * - groupSettingUpdate(jid, setting)  → only 2 args, no value param
 * - fetchMessageHistory(count, oldestMsgKey, oldestMsgTimestamp) → returns string (requestId)
 * - chatModify({ pin, lastMessages }, jid)  → pin uses { pin } object, NOT lastMessages
 * - chatModify({ archive, lastMessages }, jid)  → archive uses { archive, lastMessages }
 * - downloadMediaMessage(message, type, options, extraArgs)  → utility, not a socket method
 */
import type {
  WASocket,
  WAMessageKey,
  GroupMetadata,
} from '@whiskeysockets/baileys';

// Keep ws from loading its optional native bufferutil path inside Next bundles.
if (!process.env['WS_NO_BUFFER_UTIL']) {
  process.env['WS_NO_BUFFER_UTIL'] = 'true';
}

let baileysModule: Promise<any> | undefined;

const getBaileysModule = async () => {
  baileysModule ??= import('@whiskeysockets/baileys');
  return baileysModule;
};

const getBaileys = (mod: any, key: string) => mod[key] ?? mod.default?.[key];

export class BaileysAdapter {
  constructor(private socket: WASocket) {}

  // ── Messages ────────────────────────────────────────────────────────────

  async sendText(jid: string, text: string, options?: any) {
    return this.socket.sendMessage(jid, { text }, options);
  }

  async sendImage(jid: string, source: { url: string }, caption?: string) {
    return this.socket.sendMessage(jid, { image: source, caption });
  }

  async sendVideo(jid: string, source: { url: string }, caption?: string) {
    return this.socket.sendMessage(jid, { video: source, caption });
  }

  async sendAudio(jid: string, source: { url: string }, ptt?: boolean) {
    return this.socket.sendMessage(jid, { audio: source, ptt });
  }

  async sendDocument(jid: string, source: { url: string }, mimetype: string, fileName?: string) {
    return this.socket.sendMessage(jid, { document: source, mimetype, fileName });
  }

  async sendLocation(
    jid: string,
    degreesLatitude: number,
    degreesLongitude: number,
    name?: string,
    address?: string,
  ) {
    return this.socket.sendMessage(jid, {
      location: { degreesLatitude, degreesLongitude, name, address },
    });
  }

  async sendContact(jid: string, contact: { fullName: string; phone: string }) {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contact.fullName}`,
      `TEL;type=CELL;type=VOICE;waid=${contact.phone}:${contact.phone}`,
      'END:VCARD',
    ].join('\n');
    return this.socket.sendMessage(jid, {
      contacts: {
        displayName: contact.fullName,
        contacts: [{ vcard }],
      },
    });
  }

  async readMessages(keys: WAMessageKey[]) {
    return this.socket.readMessages(keys);
  }

  // ── Chat modifications ───────────────────────────────────────────────────

  /**
   * archiveChat — uses { archive, lastMessages } shape.
   */
  async archiveChat(jid: string, archive: boolean, lastMessages: any[]) {
    return this.socket.chatModify({ archive, lastMessages }, jid);
  }

  /**
   * pinChat — uses { pin } only. NO lastMessages (distinguishes from archive/clear/delete).
   */
  async pinChat(jid: string, pin: boolean) {
    return this.socket.chatModify({ pin }, jid);
  }

  async muteChat(jid: string, duration: number | null) {
    return this.socket.chatModify({ mute: duration }, jid);
  }

  async clearChat(jid: string, lastMessages: any[]) {
    return this.socket.chatModify({ clear: true, lastMessages }, jid);
  }

  async deleteChat(jid: string, lastMessages: any[]) {
    return this.socket.chatModify({ delete: true, lastMessages }, jid);
  }

  async markRead(jid: string, lastMessages: any[]) {
    return this.socket.chatModify({ markRead: true, lastMessages }, jid);
  }

  async starMessages(jid: string, messages: Array<{ id: string; fromMe?: boolean }>, star: boolean) {
    return this.socket.chatModify({ star: { messages, star } }, jid);
  }

  // ── Groups ───────────────────────────────────────────────────────────────

  async createGroup(subject: string, participants: string[]): Promise<GroupMetadata> {
    return this.socket.groupCreate(subject, participants);
  }

  async groupMetadata(jid: string): Promise<GroupMetadata> {
    return this.socket.groupMetadata(jid);
  }

  async updateGroupSubject(jid: string, subject: string) {
    return this.socket.groupUpdateSubject(jid, subject);
  }

  async updateGroupDescription(jid: string, description?: string) {
    return this.socket.groupUpdateDescription(jid, description);
  }

  async groupParticipantsUpdate(
    jid: string,
    participants: string[],
    action: 'add' | 'remove' | 'promote' | 'demote',
  ) {
    return this.socket.groupParticipantsUpdate(jid, participants, action);
  }

  /**
   * groupSettingUpdate — Baileys takes ONLY (jid, setting). No third value argument.
   * Allowed settings: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'
   */
  async groupSettingUpdate(
    jid: string,
    setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked',
  ) {
    return this.socket.groupSettingUpdate(jid, setting);
  }

  async groupLeave(jid: string) {
    return this.socket.groupLeave(jid);
  }

  async groupInviteCode(jid: string): Promise<string | undefined> {
    return this.socket.groupInviteCode(jid);
  }

  async groupRevokeInvite(jid: string) {
    return this.socket.groupRevokeInvite(jid);
  }

  async groupFetchAllParticipating() {
    return this.socket.groupFetchAllParticipating();
  }

  // ── Labels ───────────────────────────────────────────────────────────────

  async addChatLabel(jid: string, labelId: string) {
    return this.socket.addChatLabel(jid, labelId);
  }

  async removeChatLabel(jid: string, labelId: string) {
    return this.socket.removeChatLabel(jid, labelId);
  }

  async addLabel(jid: string, labels: any) {
    return this.socket.addLabel(jid, labels);
  }

  // ── Profile ──────────────────────────────────────────────────────────────

  async profilePictureUrl(jid: string, type?: 'image' | 'preview'): Promise<string | undefined> {
    return this.socket.profilePictureUrl(jid, type);
  }

  async getBusinessProfile(jid: string) {
    return this.socket.getBusinessProfile(jid);
  }

  async updateProfileName(name: string) {
    return this.socket.updateProfileName(name);
  }

  async updateProfileStatus(about: string) {
    return this.socket.updateProfileStatus(about);
  }

  async updateProfilePicture(jid: string, buffer: Buffer) {
    return this.socket.updateProfilePicture(jid, buffer);
  }

  async removeProfilePicture(jid: string) {
    return this.socket.removeProfilePicture(jid);
  }

  async sendPresenceUpdate(type: string, jid?: string) {
    return this.socket.sendPresenceUpdate(type as any, jid);
  }

  // ── History & Media ─────────────────────────────────────────────────────

  /**
   * fetchMessageHistory — returns a request ID string (NOT messages).
   * Messages arrive via events, not as the return value.
   */
  async fetchMessageHistory(
    count: number,
    oldestMsgKey: WAMessageKey,
    oldestMsgTimestamp: number,
  ): Promise<string> {
    return this.socket.fetchMessageHistory(count, oldestMsgKey, oldestMsgTimestamp);
  }

  /**
   * downloadMedia — delegates to downloadMediaMessage utility.
   * Passes socket.logger and socket.updateMediaRequest for reupload support.
   */
  async downloadMedia(message: any, type: 'buffer' | 'stream' = 'buffer') {
    const baileys = await getBaileysModule();
    const downloadMediaMessage = getBaileys(baileys, 'downloadMediaMessage');
    return downloadMediaMessage(message, type, {}, {
      logger: this.socket.logger,
      reuploadRequest: this.socket.updateMediaMessage.bind(this.socket),
    });
  }

  // ── Contacts ────────────────────────────────────────────────────────────

  async onWhatsApp(phone: string) {
    return this.socket.onWhatsApp(phone);
  }

  async addOrEditContact(jid: string, contact: any) {
    return (this.socket as any).addOrEditContact(jid, contact);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async end(error?: Error) {
    return this.socket.end(error);
  }

  async logout(msg?: string) {
    return this.socket.logout(msg);
  }

  /**
   * getRawSocket — exposes the raw WASocket for event subscriptions only.
   * Do NOT call socket methods directly on this in application code;
   * go through the adapter methods instead.
   */
  getRawSocket(): WASocket {
    return this.socket;
  }
}
