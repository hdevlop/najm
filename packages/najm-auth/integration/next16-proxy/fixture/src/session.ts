// The canonical app-level session module: one adapter instance, created at
// module scope, imported by every server boundary that needs a session.
import { createReactServerAuth } from 'najm-auth/client/server/react';

import { auth } from './auth';

export const serverAuth = createReactServerAuth(auth);
