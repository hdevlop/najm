import { preferences } from '../../../preferences';

// POST and DELETE belong together in `najm-kit/server`. POST stays the same
// function historical consumers exported via `handlers`.
export const POST = preferences.routes.language.POST;
export const DELETE = preferences.routes.language.DELETE;
