import { NextResponse } from 'next/server';
import { countRecovery } from '../../../../../recoveryCount';
import { signedSession } from '../../../../../signedSession';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  countRecovery();
  const cookie = request.headers.get('cookie') ?? '';
  const isRecovery = request.headers.get('x-najm-session-recovery') === '1';
  const refreshToken = readCookie(cookie, 'refreshToken');
  const role = refreshToken === 'integration-admin-refresh'
    ? 'admin'
    : refreshToken === 'integration-sponsor-refresh'
      ? 'sponsor'
      : null;
  if (!isRecovery || !role) {
    return NextResponse.json({ error: 'invalid refresh session' }, { status: 401 });
  }

  const response = NextResponse.json({ data: { recovered: true } });
  response.cookies.set('najm.session', await signedSession(role), {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}

function readCookie(header: string, name: string): string | undefined {
  for (const part of header.split(';')) {
    const [candidate, ...value] = part.trim().split('=');
    if (candidate === name) return value.join('=');
  }
  return undefined;
}
