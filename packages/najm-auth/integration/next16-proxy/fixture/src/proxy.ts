import { auth } from './auth';

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

export default async function proxy(request: Request) {
  const nonce = btoa(globalThis.crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);
  const response = await auth.proxy(request, {
    requestHeaders: {
      'content-security-policy': policy,
      'x-nonce': nonce,
    },
  });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
