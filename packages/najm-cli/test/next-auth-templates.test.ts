import { describe, expect, test } from 'bun:test';

import {
  AUTH_CONFIG_TEMPLATE,
  PROTECTED_LAYOUT_TEMPLATE,
  PROXY_TEMPLATE,
  SESSION_TEMPLATE,
} from '../src/templates';

// These templates are the canonical App Router auth boundary. The contract they
// encode is a property of the Next.js runtime, not a style choice, so drift here
// silently ships a broken scaffold. See najm-auth's README, "auth.ts and
// session.ts cannot be merged".

/**
 * Templates explain their own constraints in comments, so a raw substring search
 * matches the prose warning against a thing as readily as the thing itself.
 * Assertions about what a file *reaches* have to run on code alone.
 */
function code(template: string) {
  return template
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

describe('the scaffolded auth boundary stays three separable files', () => {
  test('auth.ts configures defineAuth and nothing React-server', () => {
    expect(AUTH_CONFIG_TEMPLATE).toContain(
      "import { defineAuth } from 'najm-auth/client/server'",
    );
    expect(code(AUTH_CONFIG_TEMPLATE)).not.toContain('client/server/react');
    expect(code(AUTH_CONFIG_TEMPLATE)).not.toContain('createReactServerAuth');
  });

  test('auth.ts supplies both redirect targets the guards need', () => {
    expect(AUTH_CONFIG_TEMPLATE).toContain('loginRoute:');
    expect(AUTH_CONFIG_TEMPLATE).toContain('forbiddenRoute:');
  });

  test('session.ts creates exactly one adapter, at module scope', () => {
    expect(SESSION_TEMPLATE).toStartWith("import 'server-only';");
    expect(SESSION_TEMPLATE).toContain(
      "import { createReactServerAuth } from 'najm-auth/client/server/react'",
    );

    const calls = SESSION_TEMPLATE.split('\n').filter((line) =>
      line.includes('createReactServerAuth('),
    );
    expect(calls).toEqual(['export const serverAuth = createReactServerAuth(auth);']);
  });

  test('session.ts reimplements no guard logic the package owns', () => {
    for (const owned of ["from 'react'", "from 'next/navigation'", 'session.roles']) {
      expect(code(SESSION_TEMPLATE)).not.toContain(owned);
    }
  });

  test('proxy.ts reaches auth.ts only, never the adapter', () => {
    expect(PROXY_TEMPLATE).toContain("import { auth } from '@/lib/auth'");
    expect(code(PROXY_TEMPLATE)).not.toContain('@/lib/session');
    expect(code(PROXY_TEMPLATE)).not.toContain('client/server/react');
  });

  test('the protected layout opts out of prerendering before guarding', () => {
    expect(PROTECTED_LAYOUT_TEMPLATE).toContain("export const dynamic = 'force-dynamic';");
    expect(PROTECTED_LAYOUT_TEMPLATE).toContain('await serverAuth.requireSession()');
    // Swallowing a strict guard turns a real outage into a silently anonymous page.
    expect(PROTECTED_LAYOUT_TEMPLATE).not.toContain('catch(() => null)');
  });
});
