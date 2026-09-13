import { readState, resetState } from '../../../../uiBackend';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { hits, diagnostics } = readState();
  return Response.json({ hits, diagnostics });
}

export async function POST(request: Request) {
  const patch = (await request.json()) as Parameters<typeof resetState>[0];
  resetState(patch);
  const { hits, diagnostics } = readState();
  return Response.json({ hits, diagnostics });
}
