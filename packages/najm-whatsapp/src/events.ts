/**
 * Public event names and payload types for the WhatsApp plugin.
 *
 * One normalized pipeline drives persistence, consumer handlers, and webhook
 * forwarding. Both Cloud webhook traffic and Baileys runtime traffic emit on
 * the same names.
 */

export const WHATSAPP_EVENTS = {
  message: 'whatsapp.message',
  status: 'whatsapp.status',
  connection: 'whatsapp.connection',
  group: 'whatsapp.group',
  presence: 'whatsapp.presence',
} as const;

/** Legacy event names kept for one release. */
export const LEGACY_WHATSAPP_EVENTS = {
  connection: 'wa.connection_update',
  group: 'wa.groups.update',
  presence: 'wa.presence.update',
} as const;

export type WhatsAppEventName = typeof WHATSAPP_EVENTS[keyof typeof WHATSAPP_EVENTS];
export type LegacyWhatsAppEventName = typeof LEGACY_WHATSAPP_EVENTS[keyof typeof LEGACY_WHATSAPP_EVENTS];

/**
 * Normalized WhatsApp message. Emitted for both Cloud webhook messages and
 * Baileys runtime messages. `jid` is the canonical address; `from` mirrors
 * `jid` for incoming messages so existing Cloud consumers keep working.
 */
export interface WhatsAppMessageEvent {
  mode: 'cloud' | 'baileys';
  instanceId: string;
  jid: string;
  from: string;
  fromMe: boolean;
  text: string;
  messageId: string;
  type: string;
  timestamp: string;
  raw: unknown;
}

export interface WhatsAppStatusEventPayload {
  instanceId: string;
  jid: string;
  from: string;
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | string;
  timestamp: string;
  raw: unknown;
}

export interface WhatsAppConnectionEvent {
  instanceId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  phone?: string;
  profileName?: string;
  reason?: unknown;
}

export interface WhatsAppGroupEvent {
  instanceId: string;
  raw: unknown;
}

export interface WhatsAppPresenceEvent {
  instanceId: string;
  raw: unknown;
}

/** All five filter names accepted by webhook subscriptions. */
export const WEBHOOK_FILTER_EVENTS = [
  'message',
  'status',
  'connection',
  'group',
  'presence',
] as const;

export type WebhookFilterEvent = typeof WEBHOOK_FILTER_EVENTS[number];
