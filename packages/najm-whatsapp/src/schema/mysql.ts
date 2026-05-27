// MySQL schema for najm-whatsapp Baileys mode
import { mysqlTable, varchar, int, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';

// ============================================================================
// Base Fields Factory
// ============================================================================

const baseFields = () => ({
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
});

// ============================================================================
// Table Definitions
// ============================================================================

/**
 * WhatsApp instances — represents one Baileys session / connection
 */
export const whatsappInstances = mysqlTable('whatsapp_instances', {
  ...baseFields(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('disconnected'),
  phone: varchar('phone', { length: 50 }),
  profileName: varchar('profile_name', { length: 255 }),
  connectedAt: timestamp('connected_at', { mode: 'string' }),
  lastSeenAt: timestamp('last_seen_at', { mode: 'string' }),
});

/**
 * Messages sent and received through Baileys
 */
export const whatsappMessages = mysqlTable('whatsapp_messages', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  instanceId: varchar('instance_id', { length: 36 }).notNull(),
  direction: varchar('direction', { length: 20 }).notNull(), // 'inbound' | 'outbound'
  jid: varchar('jid', { length: 255 }).notNull(),
  fromMe: boolean('from_me').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  content: varchar('content', { length: 65535 }),
  waMessageId: varchar('wa_message_id', { length: 255 }),
  quotedId: varchar('quoted_id', { length: 255 }),
  status: varchar('status', { length: 50 }),
  metadata: varchar('metadata', { length: 65535 }),
  timestamp: timestamp('timestamp', { mode: 'string' }).notNull(),
}, (t) => ({
  instanceIdx: index('wa_messages_instance_idx').on(t.instanceId),
  waMessageIdx: uniqueIndex('wa_messages_wa_id_idx').on(t.instanceId, t.waMessageId),
}));

/**
 * Contact cache for each WhatsApp instance
 */
export const whatsappContacts = mysqlTable('whatsapp_contacts', {
  ...baseFields(),
  instanceId: varchar('instance_id', { length: 36 }).notNull(),
  jid: varchar('jid', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  name: varchar('name', { length: 255 }),
  pushName: varchar('push_name', { length: 255 }),
  profilePictureUrl: varchar('profile_picture_url', { length: 1000 }),
  isBusiness: boolean('is_business'),
  labels: varchar('labels', { length: 1000 }),
  lastMessageAt: timestamp('last_message_at', { mode: 'string' }),
}, (t) => ({
  instanceIdx: index('wa_contacts_instance_idx').on(t.instanceId),
  jidIdx: uniqueIndex('wa_contacts_jid_idx').on(t.instanceId, t.jid),
}));

/**
 * Group metadata for each WhatsApp instance
 */
export const whatsappGroups = mysqlTable('whatsapp_groups', {
  ...baseFields(),
  instanceId: varchar('instance_id', { length: 36 }).notNull(),
  jid: varchar('jid', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),
  participantCount: int('participant_count').default(0),
  isAdmin: boolean('is_admin').default(false),
  pictureUrl: varchar('picture_url', { length: 1000 }),
}, (t) => ({
  instanceIdx: index('wa_groups_instance_idx').on(t.instanceId),
}));

/**
 * Chat list entries (inbox view) per instance
 */
export const whatsappChats = mysqlTable('whatsapp_chats', {
  ...baseFields(),
  instanceId: varchar('instance_id', { length: 36 }).notNull(),
  jid: varchar('jid', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  isGroup: boolean('is_group').notNull(),
  unreadCount: int('unread_count').default(0),
  isArchived: boolean('is_archived').default(false),
  isPinned: boolean('is_pinned').default(false),
  isMuted: boolean('is_muted').default(false),
  labels: varchar('labels', { length: 1000 }),
  lastMessageAt: timestamp('last_message_at', { mode: 'string' }),
}, (t) => ({
  instanceIdx: index('wa_chats_instance_idx').on(t.instanceId),
}));

/**
 * Labels defined per instance
 */
export const whatsappLabels = mysqlTable('whatsapp_labels', {
  ...baseFields(),
  instanceId: varchar('instance_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 30 }).notNull(),
  predefined: boolean('predefined').default(false),
});

/**
 * Configured webhook subscribers (dynamic CRUD)
 */
export const whatsappWebhooks = mysqlTable('whatsapp_webhooks', {
  ...baseFields(),
  instanceId: varchar('instance_id', { length: 36 }),
  url: varchar('url', { length: 1000 }).notNull(),
  events: varchar('events', { length: 1000 }),
  headers: varchar('headers', { length: 65535 }),
  enabled: boolean('enabled').notNull().default(true),
});

/**
 * Webhook event log
 */
export const whatsappWebhookEvents = mysqlTable('whatsapp_webhook_events', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  instanceId: varchar('instance_id', { length: 36 }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: varchar('payload', { length: 65535 }),
  forwardStatus: varchar('forward_status', { length: 50 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

/**
 * Studio audit log
 */
export const whatsappStudioAuditLogs = mysqlTable('whatsapp_studio_audit_logs', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  action: varchar('action', { length: 100 }).notNull(),
  instanceId: varchar('instance_id', { length: 36 }),
  userId: varchar('user_id', { length: 36 }),
  details: varchar('details', { length: 65535 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

/**
 * Baileys session credentials (auth state)
 */
export const whatsappSessions = mysqlTable('whatsapp_sessions', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  instanceId: varchar('instance_id', { length: 36 }).notNull().unique(),
  creds: varchar('creds', { length: 65535 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
});

/**
 * Baileys Signal keys (app-state-sync-key, pre-keys, etc.)
 */
export const whatsappSessionKeys = mysqlTable('whatsapp_session_keys', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  instanceId: varchar('instance_id', { length: 36 }).notNull(),
  keyType: varchar('key_type', { length: 100 }).notNull(),
  keyId: varchar('key_id', { length: 255 }).notNull(),
  value: varchar('value', { length: 65535 }).notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('wa_session_keys_unique').on(t.instanceId, t.keyType, t.keyId),
}));

/**
 * Auto-reply rules per instance
 */
export const whatsappAutoReplyRules = mysqlTable('whatsapp_auto_reply_rules', {
  ...baseFields(),
  instanceId: varchar('instance_id', { length: 36 }).notNull(),
  pattern: varchar('pattern', { length: 500 }).notNull(),
  response: varchar('response', { length: 4000 }).notNull(),
  matchType: varchar('match_type', { length: 20 }).notNull().default('exact'),
  enabled: boolean('enabled').notNull().default(true),
});

/**
 * AI configuration per instance
 */
export const whatsappAiConfigs = mysqlTable('whatsapp_ai_configs', {
  instanceId: varchar('instance_id', { length: 36 }).primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  provider: varchar('provider', { length: 50 }),
  model: varchar('model', { length: 100 }),
  systemPrompt: varchar('system_prompt', { length: 4000 }),
  temperature: varchar('temperature', { length: 10 }),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
});

// ============================================================================
// Schema Aggregation
// ============================================================================

export const waSchema = {
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
  whatsappAutoReplyRules,
  whatsappAiConfigs,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type WhatsAppInstance = typeof whatsappInstances.$inferSelect;
export type NewWhatsAppInstance = typeof whatsappInstances.$inferInsert;

export type WhatsAppMessage = typeof whatsappMessages.$inferSelect;
export type NewWhatsAppMessage = typeof whatsappMessages.$inferInsert;

export type WhatsAppContact = typeof whatsappContacts.$inferSelect;
export type NewWhatsAppContact = typeof whatsappContacts.$inferInsert;

export type WhatsAppGroup = typeof whatsappGroups.$inferSelect;
export type NewWhatsAppGroup = typeof whatsappGroups.$inferInsert;

export type WhatsAppChat = typeof whatsappChats.$inferSelect;
export type NewWhatsAppChat = typeof whatsappChats.$inferInsert;

export type WhatsAppLabel = typeof whatsappLabels.$inferSelect;
export type NewWhatsAppLabel = typeof whatsappLabels.$inferInsert;

export type WhatsAppWebhook = typeof whatsappWebhooks.$inferSelect;
export type NewWhatsAppWebhook = typeof whatsappWebhooks.$inferInsert;

export type WhatsAppWebhookEvent = typeof whatsappWebhookEvents.$inferSelect;
export type NewWhatsAppWebhookEvent = typeof whatsappWebhookEvents.$inferInsert;

export type WhatsAppStudioAuditLog = typeof whatsappStudioAuditLogs.$inferSelect;
export type NewWhatsAppStudioAuditLog = typeof whatsappStudioAuditLogs.$inferInsert;

export type WhatsAppSession = typeof whatsappSessions.$inferSelect;
export type NewWhatsAppSession = typeof whatsappSessions.$inferInsert;

export type WhatsAppSessionKey = typeof whatsappSessionKeys.$inferSelect;
export type NewWhatsAppSessionKey = typeof whatsappSessionKeys.$inferInsert;

export type WhatsAppAutoReplyRule = typeof whatsappAutoReplyRules.$inferSelect;
export type NewWhatsAppAutoReplyRule = typeof whatsappAutoReplyRules.$inferInsert;

export type WhatsAppAiConfig = typeof whatsappAiConfigs.$inferSelect;
export type NewWhatsAppAiConfig = typeof whatsappAiConfigs.$inferInsert;
