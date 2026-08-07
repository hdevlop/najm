import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Theme cookie endpoint for `NajmNextUIProvider`.
 *
 * The kit calls this contract; it does not ship it. Any handler that takes
 * `{ theme }`, persists it, and returns a 2xx will do — this is the worked
 * example. A static segment outranks the `[...route]` catch-all next to it, so
 * this never reaches the Najm backend.
 */

export const UI_THEME_COOKIE = 'najm-ui-theme';

const THEMES = new Set(['light', 'dark']);

export async function POST(request: Request) {
  let theme: unknown;
  try {
    ({ theme } = (await request.json()) as { theme?: unknown });
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  if (typeof theme !== 'string' || !THEMES.has(theme)) {
    return NextResponse.json(
      { error: 'theme must be "light" or "dark"' },
      { status: 400 },
    );
  }

  const store = await cookies();
  store.set(UI_THEME_COOKIE, theme, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ theme });
}
