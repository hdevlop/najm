import { afterAll, expect, test } from 'bun:test';
import { installBrowserGlobals } from './support/browserGlobals';

const browser = installBrowserGlobals();
const { createAccountSelection } = await import('../src/client/access');
const { NAMESPACE } = await import('./support/app');
const { invalidateSelection, pointerValue, selectAccount, selectedReplica } = createAccountSelection({ namespace: NAMESPACE });
afterAll(() => browser.uninstall());

const readAccess = (active: NonNullable<Awaited<ReturnType<typeof selectedReplica>>>) =>
  active.storage.replica.database.get('metadata', 'access');

test('concurrent callers share one view, and an edit fence keeps the connection a download still uses', async () => {
  await selectAccount('teacher-1');
  const [first, second] = await Promise.all([selectedReplica(), selectedReplica()]);
  expect(first).toBe(second);
  const before = JSON.parse(pointerValue()!);
  invalidateSelection();
  expect(JSON.parse(pointerValue()!)).toMatchObject({ accountId: 'teacher-1' });
  expect(JSON.parse(pointerValue()!).fence).not.toBe(before.fence);
  const renewed = await selectedReplica();
  expect(renewed).not.toBe(first);
  // The new selection shares the database; the old view still reads through it.
  expect(renewed!.storage.replica).toBe(first!.storage.replica);
  expect(await readAccess(first!)).toBeUndefined();
});

test('an account switch closes the previous account database and opens the next one', async () => {
  await selectAccount('teacher-1');
  const previous = await selectedReplica();
  await selectAccount('parent-2');
  const next = await selectedReplica();
  expect(next!.identity.accountId).toBe('parent-2');
  expect(next!.storage.replica).not.toBe(previous!.storage.replica);
  await expect(readAccess(previous!)).rejects.toThrow();
  expect(await readAccess(next!)).toBeUndefined();
  await selectAccount(null);
  expect(await selectedReplica()).toBeNull();
  await expect(readAccess(next!)).rejects.toThrow();
});
