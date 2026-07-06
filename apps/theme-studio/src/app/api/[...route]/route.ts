import 'reflect-metadata';
import { handle } from 'najm-core';
import type { server as ThemeStudioServer } from '@/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let adapt: ReturnType<typeof handle> | undefined;

async function getAdapt() {
  if (!adapt) {
    const { server } = await import('@/server') as { server: typeof ThemeStudioServer };
    adapt = handle(server);
  }

  return adapt;
}

async function route(req: Request) {
  return (await getAdapt())(req);
}

export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
