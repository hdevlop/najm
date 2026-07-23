// ── Baileys mode types ──────────────────────────────────────────────────────

export type WhatsAppMode = 'cloud' | 'baileys';

export interface WhatsAppCloudConfig {
  mode?: 'cloud';
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  webhookSecret: string;
  apiVersion?: string;
  otpTemplate?: string;
  otpTemplateLang?: string;
}

export interface WhatsAppBaileysConfig {
  mode: 'baileys';
  dialect?: 'sqlite' | 'pg' | 'mysql';
  studioApi?: boolean;
  sessions?: {
    driver: 'db' | 'file';
    path?: string;
  };
  webhooks?: Array<{
    url: string;
    events?: string[];
    headers?: Record<string, string>;
    instanceId?: string;
    signingSecret?: string;
  }>;
  /**
   * Optional shared secret used to sign outbound webhook deliveries.
   * Receivers should verify `x-najm-signature-256` with timing-safe comparison.
   */
  webhookSigningSecret?: string;
  /**
   * SSRF policy for outbound webhook deliveries. By default private network
   * addresses (loopback, RFC1918, link-local, etc.) are rejected.
   */
  webhookSecurity?: {
    allowPrivateNetworks?: boolean;
    allowedHosts?: string[];
  };
  defaultAgent?: string;
}

// ── Existing Cloud API interface (backward compat) ─────────────────────────

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  webhookSecret: string;
  apiVersion?: string;
  otpTemplate?: string;
  otpTemplateLang?: string;
}

// ── Legacy exports ─────────────────────────────────────────────────────────

export type WhatsAppMediaType = 'image' | 'document' | 'audio' | 'video' | 'sticker';

export interface WhatsAppIncomingMessage {
  from: string;
  text: string;
  messageId: string;
  timestamp: string;
  type: string;
  raw: any;
}

export interface WhatsAppStatusEvent {
  from: string;
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  raw: any;
}

export interface WhatsAppSendResult {
  messagingProduct: string;
  contacts: Array<{ waId: string; input: string }>;
  messages: Array<{ id: string }>;
}