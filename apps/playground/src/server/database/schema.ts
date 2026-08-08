import {
  authSchema,
  credentialSetupRequirementsTable,
  credentialSetupSessionsTable,
  oauthAccountsTable,
  permissionsTable,
  rolePermissionsTable,
  rolesTable,
  tokensTable,
  usersTable,
} from 'najm-auth/sqlite';
import { aiSettingsTable, chatSessionsTable, chatbotCoreSchema } from 'najm-chatbot/sqlite';
import { ragSchema } from 'najm-rag/sqlite';
import { storageSchema } from 'najm-storage/sqlite';
import {
  waSchema as whatsappSchema,
  whatsappInstances,
  whatsappMessages,
  whatsappContacts,
  whatsappGroups,
  whatsappChats,
  whatsappLabels,
  whatsappWebhooks,
  whatsappWebhookEvents,
  whatsappStudioAuditLogs,
  whatsappSessions,
  whatsappSessionKeys,
} from 'najm-whatsapp/sqlite';
import { cartItemsTable } from '../modules/cart/CartSchema';
import { orderItemsTable, ordersTable } from '../modules/order/OrderSchema';
import { productsTable } from '../modules/product/ProductSchema';

// Named here as well as spread into `schema` below: drizzle-kit builds
// migrations from this file's named table exports, not from the aggregate.
export {
  aiSettingsTable,
  cartItemsTable,
  chatSessionsTable,
  credentialSetupRequirementsTable,
  credentialSetupSessionsTable,
  orderItemsTable,
  ordersTable,
  oauthAccountsTable,
  permissionsTable,
  productsTable,
  rolePermissionsTable,
  rolesTable,
  tokensTable,
  usersTable,
  whatsappInstances,
  whatsappMessages,
  whatsappContacts,
  whatsappGroups,
  whatsappChats,
  whatsappLabels,
  whatsappWebhooks,
  whatsappWebhookEvents,
  whatsappStudioAuditLogs,
  whatsappSessions,
  whatsappSessionKeys,
};

export const schema = {
  ...authSchema,
  ...chatbotCoreSchema,
  ...ragSchema,
  ...storageSchema,
  ...whatsappSchema,
  products: productsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  cartItems: cartItemsTable,
};
