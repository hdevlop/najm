import { auth } from './auth';

export default auth.proxy;
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
