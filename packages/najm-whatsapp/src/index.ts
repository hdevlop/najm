export { whatsapp } from './WhatsAppPlugin';
export { WHATSAPP_CONFIG, WA_SCHEMA, BAILEYS_CONFIG } from './tokens';

export { WhatsAppService } from './WhatsAppService';
export { WhatsAppController } from './WhatsAppController';
export { PhoneLinkService } from './auth/PhoneLinkService';
export { PhoneLinkController } from './auth/PhoneLinkController';
export { OnWhatsApp } from './decorators/OnWhatsApp';
export type { WhatsAppEventType } from './decorators/OnWhatsApp';
export * from './events';
export * from './studio';
export * from './dto';
export * from './engine';
export * from './services';
export * from './schema';

export type {
  WhatsAppConfig,
  WhatsAppCloudConfig,
  WhatsAppBaileysConfig,
  WhatsAppMode,
  WhatsAppMediaType,
  WhatsAppIncomingMessage,
  WhatsAppStatusEvent,
  WhatsAppSendResult,
} from './types';
