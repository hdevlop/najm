import { NextResponse } from 'next/server';
import { signedSession } from '../../../../../session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  const isRecovery = request.headers.get('x-najm-session-recovery') === '1';
  if (!isRecovery || !cookie.includes('refreshToken=integration-refresh-token')) {
    return NextResponse.json({ error: 'invalid refresh session' }, { status: 401 });
  }

  const response = NextResponse.json({ data: { recovered: true } });
  response.cookies.set('najm.session', await signedSession(), {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}
