import { describe, expect, test } from 'bun:test';
import { getTableConfig as pgTableConfig } from 'drizzle-orm/pg-core';
import { getTableConfig as sqliteTableConfig } from 'drizzle-orm/sqlite-core';
import { parseSessionCookiePayload } from '../src/client/sessionCookie';
import { usersTable as pgUsers } from '../src/schema/pg';
import { usersTable as sqliteUsers } from '../src/schema/sqlite';
import { createUserDto } from '../src/users/UserDto';
import { harness } from './helpers/securityHarness';

// An account is reached by its email, its phone, or both — never neither.
// Email used to be NOT NULL, so every account created without one was stored
// as "" and the second such account broke the unique index.
describe('an account needs an email or a phone', () => {
  test('both schemas make email nullable and require one of the two', () => {
    for (const config of [pgTableConfig(pgUsers), sqliteTableConfig(sqliteUsers)]) {
      expect(config.columns.find((column) => column.name === 'email')?.notNull).toBe(false);
      expect(config.checks.map((check) => check.name)).toContain('users_email_or_phone');
    }
  });

  test('creates several phone-only accounts, storing no email', async () => {
    const h = await harness();
    const first = await h.users.create({ phone: '0612345601', password: 'ValidPass123' });
    const second = await h.users.create({ email: '  ', phone: '+212612345602', password: 'ValidPass123' });

    expect((await h.userRecords.getRawById(first.id))?.email).toBeNull();
    expect((await h.userRecords.getRawById(second.id))?.email).toBeNull();
    expect((await h.userRecords.getRawById(first.id))?.phone).toBe('+212612345601');
  });

  test('creates an account with both, normalizing each', async () => {
    const h = await harness();
    const user = await h.users.create({ email: ' Both@Example.Test ', phone: '0612345603', password: 'ValidPass123' });
    const row = await h.userRecords.getRawById(user.id);
    expect(row?.email).toBe('both@example.test');
    expect(row?.phone).toBe('+212612345603');
  });

  test.each([
    [{}],
    [{ email: '', phone: '' }],
    [{ email: '   ', phone: null }],
  ])('refuses an account with neither (%p)', async (identity) => {
    const h = await harness();
    await expect(h.users.create({ ...identity, password: 'ValidPass123' }))
      .rejects.toMatchObject({ status: 400, message: 'errors.emailOrPhoneRequired' });
  });

  test('clears an email only while a phone remains', async () => {
    const h = await harness();
    await expect(h.users.update('one', { email: '' }))
      .rejects.toMatchObject({ status: 400, message: 'errors.emailOrPhoneRequired' });
    expect((await h.userRecords.getRawById('one'))?.email).toBe('One@Example.Test');

    await h.users.update('one', { phone: '0612345604' });
    await h.users.update('one', { email: '' });
    expect((await h.userRecords.getRawById('one'))?.email).toBeNull();

    await expect(h.users.update('one', { phone: null }))
      .rejects.toMatchObject({ status: 400, message: 'errors.emailOrPhoneRequired' });
    await expect(h.users.update('one', { email: null, phone: '' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('the database refuses a row with neither, as a 400', async () => {
    const h = await harness();
    await expect(h.validator.writeUnique(() => h.userRecords.update('two', { email: null })))
      .rejects.toMatchObject({ status: 400, message: 'errors.emailOrPhoneRequired' });
  });

  test('the admin route accepts a phone without an email', () => {
    expect(createUserDto.safeParse({ phone: '+212612345605', password: 'ValidPass123' }).success).toBe(true);
    expect(createUserDto.safeParse({ email: 'not-an-email', password: 'ValidPass123' }).success).toBe(false);
  });

  test('a signed-in phone-only account keeps its session snapshot', () => {
    const snapshot = (email: unknown) => JSON.stringify({
      user: { id: 'u1', email, role: 'parent' },
      roles: ['parent'],
      permissions: [],
      sessionVersion: 0,
      tokenFamily: 'family',
      iat: Date.now(),
    });

    expect(parseSessionCookiePayload(snapshot(null))?.user.email).toBeNull();
    expect(parseSessionCookiePayload(snapshot('a@example.test'))?.user.email).toBe('a@example.test');
    expect(parseSessionCookiePayload(snapshot(''))).toBeNull();
  });
});
