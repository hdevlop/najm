import { handle } from 'najm-api';
import { server } from '@/server';

const adapt = handle(server);

export const GET = adapt;
export const POST = adapt;
export const PUT = adapt;
export const PATCH = adapt;
export const DELETE = adapt;
