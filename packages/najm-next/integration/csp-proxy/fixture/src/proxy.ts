import { composeNajmProxy } from 'najm-next/security';
import { kafilLocation, kafilStyleApp, schoolLocation, schoolStyleApp } from './najm.config';
import { stubAuth } from './stubAuth';

const kafilProxy = composeNajmProxy({
  auth: stubAuth,
  app: kafilStyleApp,
  resolveLocationCsp: (env) => kafilLocation.resolve(env).csp,
});

const schoolProxy = composeNajmProxy({
  auth: stubAuth,
  app: schoolStyleApp,
  resolveLocationCsp: (env) => schoolLocation.resolve(env).csp,
});

export default async function proxy(request: Request) {
  if (new URL(request.url).pathname.startsWith('/school')) {
    return schoolProxy(request);
  }
  return kafilProxy(request);
}

// Static matcher literal, as Next 16 requires: document pages plus the
// protected boundary run through the proxy; APIs, Next internals, and static
// assets do not.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:css|js|map|json|txt|xml|ico|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|webmanifest)$).*)',
  ],
};
