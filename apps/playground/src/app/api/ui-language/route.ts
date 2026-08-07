import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { translations } from '@/locales';

/**
 * Language cookie endpoint for `NajmAppProvider`.
 *
 * Same contract as `ui-theme`: take `{ language }`, persist it, return a 2xx.
 * The kit calls it and does not ship it.
 *
 * Note what this handler does *not* do: trigger a router refresh. `najm-i18n`
 * swaps catalogs on the client, so the new strings are already on screen before
 * this request resolves — the cookie only decides what the next full page load
 * starts from.
 */

export const UI_LANGUAGE_COOKIE = 'najm-ui-language';

const LANGUAGES = new Set(Object.keys(translations));

export async function POST(request: Request) {
  let language: unknown;
  try {
    ({ language } = (await request.json()) as { language?: unknown });
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  if (typeof language !== 'string' || !LANGUAGES.has(language)) {
    return NextResponse.json(
      { error: `language must be one of ${[...LANGUAGES].join(', ')}` },
      { status: 400 },
    );
  }

  const store = await cookies();
  store.set(UI_LANGUAGE_COOKIE, language, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ language });
}
