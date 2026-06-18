import { Server } from 'najm-api';
import {
  databaseConfig,
  authConfig,
  cookiesConfig,
  corsConfig,
  i18nConfig,
  eventsConfig,
  mcpConfig,
  validationConfig,
  rateLimitConfig,
  storageConfig,
  ragConfig,
  ragStudioConfig,
  chatbotConfig,
  studioAssistantConfig,
  whatsappConfig,
} from './config/plugins';

import * as modulesModule from './modules';
import * as listenersModule from './listeners';

export const server = new Server()
  .use(corsConfig())
  .use(databaseConfig())
  .use(i18nConfig())
  .use(validationConfig())
  .use(cookiesConfig())
  .use(eventsConfig())
  .use(rateLimitConfig())
  .use(mcpConfig())
  .use(authConfig())
  .use(storageConfig())
  .use(ragConfig())
  .use(ragStudioConfig())
  .use(chatbotConfig())
  .use(studioAssistantConfig())
  .use(whatsappConfig())
  .base('/api')
  .load(modulesModule, listenersModule);
