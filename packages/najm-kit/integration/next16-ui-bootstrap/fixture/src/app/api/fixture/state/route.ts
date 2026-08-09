import { readState, resetState } from '../../../../uiBackend';

export const dynamic = 'force-dynamic';

/** How many endpoint hits and diagnostics the last navigation produced. */
export async function GET() {
  const { hits, diagnostics, brandingStatus, revision } = readState();
  return Response.json({ hits, diagnostics, brandingStatus, revision });
}

/** Resets the counters and, optionally, breaks the branding endpoint. */
export async function POST(request: Request) {
  const patch = (await request.json()) as { brandingStatus?: number; revision?: number };
  resetState(patch);
  return Response.json(readState());
}
