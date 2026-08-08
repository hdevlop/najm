import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Time zone cookie endpoint for `NajmNextUIProvider`.
 *
 * Same contract as `ui-theme`: take `{ timeZone }`, persist it, return a 2xx.
 * The kit calls it and does not ship it.
 *
 * Unlike theme and language there is no fixed vocabulary to check against, so
 * validation asks `Intl` whether it can format in the zone. That accepts
 * aliases such as `Asia/Calcutta` which `Intl.supportedValuesOf('timeZone')`
 * omits — rejecting a zone the platform can actually format would be the wrong
 * answer, and is the same check `NajmPreferencesProvider` applies client-side.
 */

export const UI_TIME_ZONE_COOKIE = 'najm-ui-timezone';

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let timeZone: unknown;
  try {
    ({ timeZone } = (await request.json()) as { timeZone?: unknown });
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  if (typeof timeZone !== 'string' || !isValidTimeZone(timeZone)) {
    return NextResponse.json(
      { error: 'timeZone must be a valid IANA zone' },
      { status: 400 },
    );
  }

  const store = await cookies();
  store.set(UI_TIME_ZONE_COOKIE, timeZone, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ timeZone });
}
