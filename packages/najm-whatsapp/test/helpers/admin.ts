/**
 * Test helper: seed an admin role + user and return a Bearer token.
 * Used by studio controller tests (`@isAdmin()` guards require admin role).
 */
import type { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';

const ADMIN_ROLE_ID = 'role_admin_test';

export function seedAdminRole(sqlite: Database) {
  const now = new Date().toISOString();
  sqlite.exec(`INSERT OR IGNORE INTO roles (id, name, description, created_at, updated_at)
    VALUES ('${ADMIN_ROLE_ID}', 'admin', 'admin test role', '${now}', '${now}')`);
}

export async function registerAdmin(
  port: number,
  sqlite: Database,
  email = `admin+${randomUUID()}@test.local`,
  password = 'Password123!',
): Promise<string> {
  seedAdminRole(sqlite);
  await fetch(`http://localhost:${port}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Admin' }),
  });
  sqlite.exec(`UPDATE users SET role_id = '${ADMIN_ROLE_ID}' WHERE email = '${email}'`);
  const loginRes = await fetch(`http://localhost:${port}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await loginRes.json();
  return body.data.accessToken as string;
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
