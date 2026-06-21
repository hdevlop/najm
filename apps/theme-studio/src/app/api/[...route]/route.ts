import 'reflect-metadata';
import { handle } from 'najm-core';
import { server } from '@/server';

export const runtime = 'nodejs';

const adapt = handle(server);

export const GET = adapt;
export const POST = adapt;
export const PUT = adapt;
export const PATCH = adapt;
export const DELETE = adapt;