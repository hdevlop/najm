import { withAuthCookiePersistence } from 'najm-auth/client/server';

const logoutHandler = withAuthCookiePersistence(async () => {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.append(
    'set-cookie',
    'refreshToken=stale; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax',
  );
  headers.append('set-cookie', 'unrelated=kept; Path=/');
  return new Response(JSON.stringify({ data: null }), { headers });
});

export function POST(request: Request) {
  return logoutHandler(request);
}
