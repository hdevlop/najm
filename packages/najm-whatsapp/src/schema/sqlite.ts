// SQLite schema for najm-whatsapp Baileys mode
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'crypto';

// ============================================================================
// Base Fields Factory
// ============================================================================

const baseFields = () => ({
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// ============================================================================
// Table Definitions
// ============================================================================

/**
 * WhatsApp instances — represents one Baileys session / connection
 */
export const whatsappInstances = sqliteTable('whatsapp_instances', {
  ...baseFields(),
  name: text('name').notNull(),
  status: text('status').notNull().default('disconnected'),
  phone: text('phone'),
  profileName: text('profile_name'),
  connectedAt: text('connected_at'),
  lastSeenAt: text('last_seen_at'),
});

/**
 * Messages sent and received through Baileys
 */
export const whatsappMessages = sqliteTable('whatsapp_messages', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  instanceId: text('instance_id').notNull(),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  jid: text('jid').notNull(),
  fromMe: integer('from_me', { mode: 'boolean' }).notNull(),
  type: text('type').notNull(),
  content: text('content'),
  waMessageId: text('wa_message_id'),
  quotedId: text('quoted_id'),
  status: text('status'),
  metadata: text('metadata'),
  timestamp: text('timestamp').notNull(),
}, (t) => ({
  instanceIdx: index('wa_messages_instance_idx').on(t.instanceId),
  waMessageIdx: uniqueIndex('wa_messages_wa_id_idx').on(t.instanceId, t.waMessageId),
}));

/**
 * Contact cache for each WhatsApp instance
 */
export const whatsappContacts = sqliteTable('whatsapp_contacts', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  jid: text('jid').notNull(),
  phone: text('phone'),
  name: text('name'),
  pushName: text('push_name'),
  profilePictureUrl: text('profile_picture_url'),
  isBusiness: integer('is_business', { mode: 'boolean' }),
  labels: text('labels'),
  lastMessageAt: text('last_message_at'),
}, (t) => ({
  instanceIdx: index('wa_contacts_instance_idx').on(t.instanceId),
  jidIdx: uniqueIndex('wa_contacts_jid_idx').on(t.instanceId, t.jid),
}));

/**
 * Group metadata for each WhatsApp instance
 */
export const whatsappGroups = sqliteTable('whatsapp_groups', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  jid: text('jid').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  participantCount: integer('participant_count').default(0),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  pictureUrl: text('picture_url'),
}, (t) => ({
  instanceIdx: index('wa_groups_instance_idx').on(t.instanceId),
}));

/**
 * Chat list entries (inbox view) per instance
 */
export const whatsappChats = sqliteTable('whatsapp_chats', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  jid: text('jid').notNull(),
  name: text('name'),
  isGroup: integer('is_group', { mode: 'boolean' }).notNull(),
  unreadCount: integer('unread_count').default(0),
  isArchived: integer('is_archived', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  isMuted: integer('is_muted', { mode: 'boolean' }).default(false),
  labels: text('labels'),
  lastMessageAt: text('last_message_at'),
}, (t) => ({
  instanceIdx: index('wa_chats_instance_idx').on(t.instanceId),
}));

/**
 * Labels defined per instance
 */
export const whatsappLabels = sqliteTable('whatsapp_labels', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  predefined: integer('predefined', { mode: 'boolean' }).default(false),
});

/**
 * Configured webhook subscribers (dynamic CRUD)
 */
export const whatsappWebhooks = sqliteTable('whatsapp_webhooks', {
  ...baseFields(),
  instanceId: text('instance_id'),
  url: text('url').notNull(),
  events: text('events'),
  headers: text('headers'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
});

/**
 * Webhook event log
 */
export const whatsappWebhookEvents = sqliteTable('whatsapp_webhook_events', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  instanceId: text('instance_id'),
  eventType: text('event_type').notNull(),
  payload: text('payload'),
  forwardStatus: text('forward_status'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

/**
 * Studio audit log
 */
export const whatsappStudioAuditLogs = sqliteTable('whatsapp_studio_audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  action: text('action').notNull(),
  instanceId: text('instance_id'),
  userId: text('user_id'),
  details: text('details'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

/**
 * Baileys session credentials (auth state)
 */
export const whatsappSessions = sqliteTable('whatsapp_sessions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  instanceId: text('instance_id').notNull().unique(),
  creds: text('creds'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
});

/**
 * Baileys Signal keys (app-state-sync-key, pre-keys, etc.)
 */
export const whatsappSessionKeys = sqliteTable('whatsapp_session_keys', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  instanceId: text('instance_id').notNull(),
  keyType: text('key_type').notNull(),
  keyId: text('key_id').notNull(),
  value: text('value').notNull(),
}, (t) => ({
  uniqueIdx: uniqueIndex('wa_session_keys_unique').on(t.instanceId, t.keyType, t.keyId),
}));

/**
 * Auto-reply rules per instance
 */
export const whatsappAutoReplyRules = sqliteTable('whatsapp_auto_reply_rules', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  pattern: text('pattern').notNull(),
  response: text('response').notNull(),
  matchType: text('match_type', { enum: ['exact', 'prefix', 'regex'] }).notNull().default('exact'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

/**
 * AI configuration per instance
 */
export const whatsappAiConfigs = sqliteTable('whatsapp_ai_configs', {
  instanceId: text('instance_id').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  provider: text('provider'),
  model: text('model'),
  systemPrompt: text('system_prompt'),
  temperature: text('temperature'),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
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
