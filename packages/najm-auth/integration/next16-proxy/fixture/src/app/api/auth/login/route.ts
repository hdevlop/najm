import { NextResponse } from 'next/server';
import { signedSession } from '../../../../session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ data: { authenticated: true } });
  response.cookies.set('refreshToken', 'integration-refresh-token', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  response.cookies.set('najm.session', await signedSession(), {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}
