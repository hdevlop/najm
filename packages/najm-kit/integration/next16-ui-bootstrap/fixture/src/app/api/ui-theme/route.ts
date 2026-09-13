import { preferences } from '../../../preferences';

// The whole route file. Not a wrapper around the handler — the handler.
// POST stays the same function historical consumers exported via `handlers`.
export const POST = preferences.routes.theme.POST;
export const DELETE = preferences.routes.theme.DELETE;
