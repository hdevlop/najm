import { defineAuth } from 'najm-auth/client/server';
import { authConfig } from './auth-config';

export const auth = defineAuth(authConfig);
