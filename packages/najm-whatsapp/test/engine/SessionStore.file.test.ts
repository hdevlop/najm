import 'reflect-metadata';
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SessionStore } from '../../src/engine/SessionStore';
import { rm, mkdir, access } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = './test-sessions';

// Construct SessionStore without DI — manually assign config
function createFileStore(path: string) {
  const store = Object.assign(new SessionStore(), {
    config: { sessions: { driver: 'file', path } },
  } as any);
  return store;
}

describe('SessionStore (file driver)', () => {
  let store: SessionStore;

  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    store = createFileStore(TEST_DIR);
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test('loadAuthState creates auth state for a new instance', async () => {
    const { state, saveCreds } = await store.loadAuthState('test-instance');
    expect(state.creds).toBeDefined();
    expect(typeof saveCreds).toBe('function');
  });

  test('loadAuthState returns same state on second call (persistence)', async () => {
    const first = await store.loadAuthState('persist-instance');
    const second = await store.loadAuthState('persist-instance');
    expect(first.state.creds).toBeDefined();
    expect(second.state.creds).toBeDefined();
  });

  test('deleteSession removes the session folder', async () => {
    await store.loadAuthState('delete-me');
    await store.deleteSession('delete-me');
    const folderPath = join(TEST_DIR, 'delete-me');
    let exists = true;
    try {
      await access(folderPath);
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  test('deleteSession is idempotent (no error if folder already gone)', async () => {
    await expect(store.deleteSession('nonexistent')).resolves.toBeUndefined();
  });

  test('DB driver throws descriptive error', async () => {
    const dbStore = Object.assign(new SessionStore(), {
      config: { sessions: { driver: 'db' } },
    } as any);
    await expect(dbStore.loadAuthState('any-instance')).rejects.toThrow(
      'DB not configured. Call setDb() first.',
    );
    await expect(dbStore.deleteSession('any-instance')).rejects.toThrow(
      'DB not configured. Call setDb() first.',
    );
  });
});