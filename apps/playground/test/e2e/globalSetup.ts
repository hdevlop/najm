// ============================================================================
// Playground e2e — the precondition check
// ============================================================================
//
// The theme acceptance run is a *production* acceptance run. It proves what a
// consumer's built application serves: hashed factory URLs, immutable cache
// headers, and an RSC bootstrap that resolved a definition from `dist` rather
// than from a source tree. A `next dev` server answers all of those
// differently, so this suite deliberately has no `webServer` block — booting
// one silently is how a dev-mode pass gets mistaken for release evidence.
//
// What is left is telling the operator plainly what to start.
// ============================================================================

import { BASE_URL } from './support/constants';

const START_HINT = [
  `No server is answering at ${BASE_URL}.`,
  '',
  'The theme acceptance suite runs against an already-built production server.',
  'From the repository root:',
  '',
  "  export DATABASE_URL='../../.runtime/playground-theme-acceptance.db'",
  '  export COOKIE_SECURE=false',
  '  bun run --cwd apps/playground db:migrate',
  '  bun run --cwd apps/playground db:seed',
  '  bun run playground:next:build',
  '  bun run playground:next:bg',
  '  bun run playground:next:status   # expect: listening on port 3000',
].join('\n');

export default async function globalSetup() {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/login`, { redirect: 'manual' });
  } catch (cause) {
    throw new Error(`${START_HINT}\n\n(${(cause as Error).message})`);
  }

  if (!response.ok) {
    throw new Error(`${START_HINT}\n\n(GET /login answered ${response.status})`);
  }

  // A dev server ships its React refresh runtime in the document. Finding it
  // here means the operator started the wrong script, and every cache-header
  // and hashed-URL assertion below would be measuring the wrong thing.
  const html = await response.text();
  if (html.includes('/_next/static/chunks/react-refresh') || html.includes('__nextDevClientId')) {
    throw new Error(
      `${BASE_URL} is serving a development build.\n\n`
        + 'Stop it and start the production server instead:\n'
        + '  bun run playground:next:stop && bun run playground:next:build && bun run playground:next:bg',
    );
  }
}
