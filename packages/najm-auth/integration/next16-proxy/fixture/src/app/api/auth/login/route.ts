import { NextResponse } from 'next/server';
import { signedSession } from '../../../../session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({})) as {
    role?: 'admin' | 'sponsor';
    refreshState?: 'active' | 'expired' | 'invalid';
    sessionAgeSeconds?: number;
  };
  const role = input.role === 'sponsor' ? 'sponsor' : 'admin';
  const refreshToken = input.refreshState === 'expired'
    ? 'integration-expired-refresh'
    : input.refreshState === 'invalid'
      ? 'integration-invalid-refresh'
      : `integration-${role}-refresh`;
  const issuedAt = Date.now() - Math.max(0, input.sessionAgeSeconds ?? 0) * 1_000;
  const response = NextResponse.json({
    data: {
      authenticated: true,
      accessToken: `integration-${role}-access`,
    },
  });
  response.cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  response.cookies.set('najm.session', await signedSession(role, issuedAt), {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}
