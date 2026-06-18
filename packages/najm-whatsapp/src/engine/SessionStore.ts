/**
 * SessionStore — manages Baileys AuthenticationState for a given instance.
 *
 * Supports two drivers:
 * - `'file'` — uses Baileys' useMultiFileAuthState on the local filesystem
 * - `'db'` — DB-backed store using Drizzle ORM (db and schema injected via DI)
 */
import { join } from 'path';
import { randomUUID } from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { BAILEYS_CONFIG, WA_SCHEMA } from '../tokens';
import type { SignalKeyStore, AuthenticationState, AuthenticationCreds } from '@whiskeysockets/baileys';
import { loadBaileys, getBaileysExport } from './BaileysRuntime';

// Keep ws from loading its optional native bufferutil path inside Next bundles.
if (!process.env['WS_NO_BUFFER_UTIL']) {
  process.env['WS_NO_BUFFER_UTIL'] = 'true';
}

const getBaileys = (mod: any, key: string) => getBaileysExport(mod, key);

interface DbReference {
  select(): any;
  insert(t: any): any;
  delete(t: any): { where(...clauses: any[]): any };
}

@Service()
@Meta({ layer: 'plugin' })
export class SessionStore {
  @DB() private db!: DbReference;
  @Inject(WA_SCHEMA) private schema!: any;
  @Inject(BAILEYS_CONFIG) private config!: { sessions: { driver: 'db' | 'file'; path?: string } };

  async loadAuthState(instanceId: string): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    if (this.config.sessions.driver === 'file') {
      const baileys = await loadBaileys();
      return getBaileys(baileys, 'useMultiFileAuthState')(
        join(this.config.sessions.path ?? './sessions', instanceId),
      );
    }
    if (!this.db || !this.schema) {
      throw new Error('DB not configured. Call setDb() first.');
    }
    return this.loadFromDb(instanceId);
  }

  async deleteSession(instanceId: string): Promise<void> {
    if (this.config.sessions.driver === 'file') {
      const { rm } = await import('fs/promises');
      await rm(
        join(this.config.sessions.path ?? './sessions', instanceId),
        { recursive: true, force: true },
      );
      return;
    }
    if (!this.db || !this.schema) {
      throw new Error('DB not configured. Call setDb() first.');
    }
    const sessions = this.schema.whatsappSessions;
    const keys = this.schema.whatsappSessionKeys;
    if (sessions) {
      await this.db.delete(sessions).where(eq(sessions.instanceId, instanceId));
    }
    if (keys) {
      await this.db.delete(keys).where(eq(keys.instanceId, instanceId));
    }
  }

  private async loadFromDb(instanceId: string): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    const baileys = await loadBaileys();
    const BufferJSON = getBaileys(baileys, 'BufferJSON');
    const initAuthCreds = getBaileys(baileys, 'initAuthCreds');
    const makeCacheableSignalKeyStore = getBaileys(baileys, 'makeCacheableSignalKeyStore');
    const proto = getBaileys(baileys, 'proto');
    const sessions = this.schema!.whatsappSessions;
    const sessionKeys = this.schema!.whatsappSessionKeys;

    const encode = (value: unknown) =>
      JSON.stringify(value, BufferJSON.replacer);
    const decode = (value: string) =>
      JSON.parse(value, BufferJSON.reviver);

    const rows = await this.db!.select().from(sessions).where(eq(sessions.instanceId, instanceId)).limit(1);
    const existing = rows[0];

    const creds: AuthenticationCreds = existing?.creds
      ? decode(existing.creds)
      : initAuthCreds();

    const dbKeyStore: SignalKeyStore = {
      get: async (type, ids) => {
        if (!sessionKeys) return {};
        const keyRows = await this.db!.select().from(sessionKeys).where(
          and(eq(sessionKeys.instanceId, instanceId), eq(sessionKeys.keyType, type), inArray(sessionKeys.keyId, ids)),
        );
        const result: Record<string, any> = {};
        for (const kr of keyRows ?? []) {
          if (!kr.keyId) continue;
          const value = decode(kr.value);
          result[kr.keyId] =
            type === 'app-state-sync-key'
              ? proto.Message.AppStateSyncKeyData.fromObject(value)
              : value;
        }
        return result as any;
      },

      set: async (data) => {
        if (!sessionKeys) return;
        for (const [type, entries] of Object.entries(data)) {
          for (const [id, value] of Object.entries(entries as Record<string, unknown>)) {
            if (!value) {
              await this.db!.delete(sessionKeys).where(
                and(eq(sessionKeys.instanceId, instanceId), eq(sessionKeys.keyType, type), eq(sessionKeys.keyId, id)),
              );
              continue;
            }
            const insert = this.db!.insert(sessionKeys).values({
              id: randomUUID(),
              instanceId,
              keyType: type,
              keyId: id,
              value: encode(value),
            });
            await this.upsert(insert, {
              target: [sessionKeys.instanceId, sessionKeys.keyType, sessionKeys.keyId],
              set: { value: encode(value) },
            });
          }
        }
      },

      clear: async () => {
        if (sessionKeys) {
          await this.db!.delete(sessionKeys).where(eq(sessionKeys.instanceId, instanceId));
        }
      },
    };

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

    const keys = makeCacheableSignalKeyStore(dbKeyStore, silentLogger as any);

    const saveCreds = async () => {
      const insert = this.db!.insert(sessions).values({
        id: existing?.id ?? randomUUID(),
        instanceId,
        creds: encode(creds),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await this.upsert(insert, {
        target: [sessions.instanceId],
        set: {
          creds: encode(creds),
          updatedAt: new Date().toISOString(),
        },
      });
    };

    return { state: { creds, keys }, saveCreds };
  }

  private async upsert(insert: any, options: { target: any; set: any }) {
    if (typeof insert.onConflictDoUpdate === 'function') {
      return insert.onConflictDoUpdate(options);
    }
    if (typeof insert.onDuplicateKeyUpdate === 'function') {
      return insert.onDuplicateKeyUpdate({ set: options.set });
    }
    return insert;
  }
}
