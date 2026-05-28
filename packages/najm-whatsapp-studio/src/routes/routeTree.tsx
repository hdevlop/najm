import { rootRoute } from './__root';
import { indexRoute } from './index';
import { instancesRoute } from './instances';
import { conversationsRoute } from './conversations';
import { contactsRoute } from './contacts';
import { groupsRoute } from './groups';
import { chatOpsRoute } from './chat-ops';
import { labelsRoute } from './labels';
import { botRoute } from './bot';
import { profileRoute } from './profile';
import { webhooksRoute } from './webhooks';
import { settingsRoute } from './settings';

export const routeTree = rootRoute.addChildren([
  indexRoute,
  instancesRoute,
  conversationsRoute,
  contactsRoute,
  groupsRoute,
  chatOpsRoute,
  labelsRoute,
  botRoute,
  profileRoute,
  webhooksRoute,
  settingsRoute,
]);
