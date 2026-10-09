import { useAuthEvent } from './useAuthEvent';

/**
 * Sends the user to sign in when the session ends while a page is open.
 *
 * A server page checks the session only when it renders, so a session revoked
 * or expired afterwards leaves the page up: every read then answers 401, and a
 * list shows as empty instead of asking the user to sign in again.
 *
 * It is a full navigation, so the auth middleware can clear the dead cookies,
 * and `from` brings the user back to this page afterwards, as the middleware's
 * own redirect does. A normal sign-out emits `logout`, not `sessionExpired`,
 * so the sign-out button keeps its own navigation.
 *
 * Mount it once, in the layout every signed-in page shares.
 */
export function useRedirectOnSessionExpired(loginRoute = '/login'): void {
  useAuthEvent('sessionExpired', () => {
    const login = new URL(loginRoute, window.location.origin);
    login.searchParams.set('from', `${window.location.pathname}${window.location.search}`);
    window.location.assign(login.toString());
  });
}
