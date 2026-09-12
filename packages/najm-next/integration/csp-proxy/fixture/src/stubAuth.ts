import { NextResponse } from 'next/server';

/**
 * Structural stand-in for the Najm Auth proxy (`AuthKit["proxy"]`): it
 * honors the same call shape — `proxy(request, { requestHeaders })` — and
 * exercises the outcomes the composition must preserve (public passthrough
 * with downstream request headers, redirect with cookies, multi-`Set-Cookie`
 * recovery-style responses). Real session verification stays owned by
 * `najm-auth`, whose own Next 16 production suite covers it.
 */
export const stubAuth = {
  async proxy(request: Request, init?: { requestHeaders?: HeadersInit }): Promise<Response> {
    const url = new URL(request.url);
    const downstream = new Headers(request.headers);
    if (init?.requestHeaders) {
      new Headers(init.requestHeaders).forEach((value, key) => downstream.set(key, value));
    }

    if (url.pathname === '/protected') {
      const hasSession = (request.headers.get('cookie') ?? '').includes('stub.session=valid');
      if (!hasSession) {
        const redirect = NextResponse.redirect(new URL('/login?from=%2Fprotected', request.url), 307);
        redirect.headers.append('Set-Cookie', 'stub.session=; Path=/; Max-Age=0');
        return redirect;
      }
      const recovered = NextResponse.next({ request: { headers: downstream } });
      recovered.headers.append('Set-Cookie', 'stub.session=valid; Path=/; HttpOnly; SameSite=Lax');
      recovered.headers.append('Set-Cookie', 'stub.refresh=renewed; Path=/; HttpOnly; SameSite=Lax');
      recovered.headers.set('x-fixture-auth', 'recovered');
      return recovered;
    }

    return NextResponse.next({ request: { headers: downstream } });
  },
};
