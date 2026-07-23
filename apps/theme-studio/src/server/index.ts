import { Server } from 'najm-core';
import { cors } from 'najm-cors';
import { validation } from 'najm-validation';
import { databaseConfig } from './config/database';
import * as modulesModule from './modules';

const isLocalhostOrigin = (origin?: string) =>
  !!origin && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);

export const server = new Server()
  .use(cors({
    origin: ((origin: string) => isLocalhostOrigin(origin) ? origin : undefined) as unknown as string,
    credentials: true,
  }))
  .use(databaseConfig())
  .use(validation())
  .base('/api')
  .load(modulesModule);