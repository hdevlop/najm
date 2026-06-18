import { rootRoute } from './__root';
import { indexRoute } from './index';
import { knowledgeDocumentsRoute } from './knowledge/documents';
import { knowledgeChunksRoute } from './knowledge/chunks';
import { knowledgeChatRoute } from './knowledge/chat';
import { toolsRoute } from './tools';
import { semanticsRoute } from './semantics';
import { labRoute } from './lab';
import { testsRoute } from './tests';
import { chatRoute } from './chat';
import { logsRoute } from './logs';
import { unmatchedRoute } from './unmatched';
import { storageSemanticsRedirect, storageTestsRedirect } from './redirects';

export const routeTree = rootRoute.addChildren([
  indexRoute,
  knowledgeDocumentsRoute,
  knowledgeChunksRoute,
  knowledgeChatRoute,
  toolsRoute,
  semanticsRoute,
  labRoute,
  testsRoute,
  chatRoute,
  logsRoute,
  unmatchedRoute,
  storageSemanticsRedirect,
  storageTestsRedirect,
]);
