// PostgreSQL schema for najm-whatsapp Baileys mode
import { pgTable, text, boolean, timestamp, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

// ============================================================================
// Base Fields Factory
// ============================================================================

const baseFields = () => ({
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
});

// ============================================================================
// Table Definitions
// ============================================================================

/**
 * WhatsApp instances — represents one Baileys session / connection
 */
export const whatsappInstances = pgTable('whatsapp_instances', {
  ...baseFields(),
  name: text('name').notNull(),
  status: text('status').notNull().default('disconnected'),
  phone: text('phone'),
  profileName: text('profile_name'),
  connectedAt: timestamp('connected_at', { mode: 'string' }),
  lastSeenAt: timestamp('last_seen_at', { mode: 'string' }),
});

/**
 * Messages sent and received through Baileys
 */
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  instanceId: text('instance_id').notNull(),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  jid: text('jid').notNull(),
  fromMe: boolean('from_me').notNull(),
  type: text('type').notNull(),
  content: text('content'),
  waMessageId: text('wa_message_id'),
  quotedId: text('quoted_id'),
  status: text('status'),
  metadata: text('metadata'),
  timestamp: timestamp('timestamp', { mode: 'string' }).notNull(),
}, (t) => ({
  instanceIdx: index('wa_messages_instance_idx').on(t.instanceId),
  waMessageIdx: uniqueIndex('wa_messages_wa_id_idx').on(t.instanceId, t.waMessageId),
}));

/**
 * Contact cache for each WhatsApp instance
 */
export const whatsappContacts = pgTable('whatsapp_contacts', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  jid: text('jid').notNull(),
  phone: text('phone'),
  name: text('name'),
  pushName: text('push_name'),
  profilePictureUrl: text('profile_picture_url'),
  isBusiness: boolean('is_business'),
  labels: text('labels'),
  lastMessageAt: timestamp('last_message_at', { mode: 'string' }),
}, (t) => ({
  instanceIdx: index('wa_contacts_instance_idx').on(t.instanceId),
  jidIdx: uniqueIndex('wa_contacts_jid_idx').on(t.instanceId, t.jid),
}));

/**
 * Group metadata for each WhatsApp instance
 */
export const whatsappGroups = pgTable('whatsapp_groups', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  jid: text('jid').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  participantCount: integer('participant_count').default(0),
  isAdmin: boolean('is_admin').default(false),
  pictureUrl: text('picture_url'),
}, (t) => ({
  instanceIdx: index('wa_groups_instance_idx').on(t.instanceId),
}));

/**
 * Chat list entries (inbox view) per instance
 */
export const whatsappChats = pgTable('whatsapp_chats', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  jid: text('jid').notNull(),
  name: text('name'),
  isGroup: boolean('is_group').notNull(),
  unreadCount: integer('unread_count').default(0),
  isArchived: boolean('is_archived').default(false),
  isPinned: boolean('is_pinned').default(false),
  isMuted: boolean('is_muted').default(false),
  labels: text('labels'),
  lastMessageAt: timestamp('last_message_at', { mode: 'string' }),
}, (t) => ({
  instanceIdx: index('wa_chats_instance_idx').on(t.instanceId),
}));

/**
 * Labels defined per instance
 */
export const whatsappLabels = pgTable('whatsapp_labels', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  predefined: boolean('predefined').default(false),
});

/**
 * Configured webhook subscribers (dynamic CRUD)
 */
export const whatsappWebhooks = pgTable('whatsapp_webhooks', {
  ...baseFields(),
  instanceId: text('instance_id'),
  url: text('url').notNull(),
  events: text('events'),
  headers: text('headers'),
  enabled: boolean('enabled').notNull().default(true),
});

/**
 * Webhook event log
 */
export const whatsappWebhookEvents = pgTable('whatsapp_webhook_events', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  instanceId: text('instance_id'),
  eventType: text('event_type').notNull(),
  payload: text('payload'),
  forwardStatus: text('forward_status'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

/**
 * Studio audit log
 */
export const whatsappStudioAuditLogs = pgTable('whatsapp_studio_audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  action: text('action').notNull(),
  instanceId: text('instance_id'),
  userId: text('user_id'),
  details: text('details'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

/**
 * Baileys session credentials (auth state)
 */
export const whatsappSessions = pgTable('whatsapp_sessions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  instanceId: text('instance_id').notNull().unique(),
  creds: text('creds'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow(),
});

/**
 * Baileys Signal keys (app-state-sync-key, pre-keys, etc.)
 */
export const whatsappSessionKeys = pgTable('whatsapp_session_keys', {
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
export const whatsappAutoReplyRules = pgTable('whatsapp_auto_reply_rules', {
  ...baseFields(),
  instanceId: text('instance_id').notNull(),
  pattern: text('pattern').notNull(),
  response: text('response').notNull(),
  matchType: text('match_type', { enum: ['exact', 'prefix', 'regex'] }).notNull().default('exact'),
  enabled: boolean('enabled').notNull().default(true),
});

/**
 * AI configuration per instance
 */
export const whatsappAiConfigs = pgTable('whatsapp_ai_configs', {
  instanceId: text('instance_id').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  provider: text('provider'),
  model: text('model'),
  systemPrompt: text('system_prompt'),
  temperature: text('temperature'),
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
