/**
 * BaileysInstance — single WhatsApp connection wrapper.
 *
 * Manages one Baileys socket lifecycle: connect, disconnect, logout,
 * QR code capture, connection status, event emission, and auto-reconnect.
 */
import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';
import { SessionStore } from './SessionStore';
import { BaileysAdapter } from './BaileysAdapter';
import { loadBaileys, getBaileysExport } from './BaileysRuntime';

export type InstanceStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Next's server bundle can resolve ws' optional native bufferutil dependency to
// an incompatible shape. The pure JS ws implementation is reliable here and is
// fast enough for Studio connection management.
if (!process.env['WS_NO_BUFFER_UTIL']) {
  process.env['WS_NO_BUFFER_UTIL'] = 'true';
}

const makeSocket = (mod: any) => {
  if (typeof mod.default === 'function') return mod.default;
  if (typeof mod.makeWASocket === 'function') return mod.makeWASocket;
  if (typeof mod.default?.makeWASocket === 'function') return mod.default.makeWASocket;
  throw new Error('Baileys makeWASocket export not found');
};

const getBaileys = (mod: any, key: string) => getBaileysExport(mod, key);

const RECONNECT_INITIAL_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 60_000;
const RECONNECT_MAX_ATTEMPTS = 10;

export class BaileysInstance {
  public id: string;
  public status: InstanceStatus = 'disconnected';
  public phone?: string;
  public profileName?: string;
  public qrCode?: string;

  private socket?: any;
  private adapter?: BaileysAdapter;
  private events = new EventEmitter();
  private reconnectAttempts = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private intentionalClose = false;

  constructor(
    id: string,
    private sessionStore: SessionStore,
  ) {
    this.id = id;
    this.events.setMaxListeners(50);
  }

  async connect(): Promise<void> {
    this.intentionalClose = false;
    this.status = 'connecting';
    this.emitEvent('connection_update', { status: 'connecting' });

    // Tear down any previous socket listeners before reconnect
    this.detachSocket();

    const baileys = await loadBaileys();
    const { state, saveCreds } = await this.sessionStore.loadAuthState(this.id);

    const silentLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
      child: () => silentLogger as any,
      level: 'silent' as any,
    };

    let version: any;
    try {
      version = (await getBaileys(baileys, 'fetchLatestBaileysVersion')()).version;
    } catch {
      version = undefined;
    }

    this.socket = makeSocket(baileys)({
      auth: state,
      ...(version ? { version } : {}),
      browser: getBaileys(baileys, 'Browsers').ubuntu('Najm WhatsApp Studio'),
      logger: silentLogger as any,
      printQRInTerminal: process.env.WA_PRINT_QR === 'true',
    });

    this.adapter = new BaileysAdapter(this.socket);

    // CRITICAL: register creds.update listener — never call creds.saveCreds directly
    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCode = qr;
        this.emitEvent('qr', { qr });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === getBaileys(baileys, 'DisconnectReason').loggedOut;
        this.status = 'disconnected';
        this.emitEvent('connection_update', {
          status: 'disconnected',
          reason: lastDisconnect?.error,
        });

        if (!this.intentionalClose && !loggedOut) {
          this.scheduleReconnect();
        }
      } else if (connection === 'open') {
        this.status = 'connected';
        this.qrCode = undefined;
        this.reconnectAttempts = 0;
        this.phone = this.socket.user?.id?.split(':')[0];
        this.profileName = this.socket.user?.name;
        this.emitEvent('connection_update', {
          status: 'connected',
          phone: this.phone,
          profileName: this.profileName,
        });
      }
    });

    this.socket.ev.on('messages.upsert', (m: any) => {
      for (const msg of m.messages ?? []) {
        this.emitEvent('message', {
          key: msg.key,
          from: msg.key?.remoteJid,
          fromMe: msg.key?.fromMe,
          text:
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text,
          timestamp: msg.messageTimestamp,
          type: m.type,
          raw: msg,
        });
      }
    });

    this.socket.ev.on('messages.update', (updates: any[]) => {
      for (const u of updates ?? []) {
        this.emitEvent('status', {
          messageId: u?.key?.id ?? '',
          jid: u?.key?.remoteJid ?? '',
          status: u?.update?.status ?? 'unknown',
          timestamp: Date.now(),
          raw: u,
        });
      }
    });

    this.socket.ev.on('groups.update', (updates: any[]) => {
      for (const u of updates ?? []) this.emitEvent('group', u);
    });

    this.socket.ev.on('presence.update', (p: any) => {
      this.emitEvent('presence', p);
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.detachSocket();
    this.socket?.end?.(undefined);
    this.status = 'disconnected';
  }

  async logout(): Promise<void> {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    try {
      await this.socket?.logout?.();
    } finally {
      this.detachSocket();
      await this.sessionStore.deleteSession(this.id);
      this.status = 'disconnected';
    }
  }

  getAdapter(): BaileysAdapter {
    if (!this.adapter) {
      throw new Error('Instance not connected. Call connect() first.');
    }
    return this.adapter;
  }

  onEvent(event: string, handler: (data: any) => void): () => void {
    this.events.on(event, handler);
    return () => this.events.off(event, handler);
  }

  private emitEvent(event: string, data: any) {
    const payload = { instanceId: this.id, ...data };
    this.events.emit(event, payload);
    this.events.emit('*', { event, ...payload });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.status = 'error';
      this.emitEvent('connection_update', {
        status: 'error',
        reason: new Error(`Reconnect gave up after ${RECONNECT_MAX_ATTEMPTS} attempts`),
      });
      return;
    }
    const delay = Math.min(
      RECONNECT_INITIAL_DELAY_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Failure will fire connection.update 'close' again and re-schedule
      });
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.reconnectAttempts = 0;
  }

  private detachSocket() {
    if (this.socket?.ev?.removeAllListeners) {
      this.socket.ev.removeAllListeners();
    }
  }
}
