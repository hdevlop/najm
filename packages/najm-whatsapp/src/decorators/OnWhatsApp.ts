import { On } from 'najm-event';
import { WHATSAPP_EVENTS, LEGACY_WHATSAPP_EVENTS } from '../events';

export type WhatsAppEventType = 'message' | 'status' | 'connection' | 'group' | 'presence';

const EVENT_MAP: Record<WhatsAppEventType, string> = {
  message: WHATSAPP_EVENTS.message,
  status: WHATSAPP_EVENTS.status,
  connection: WHATSAPP_EVENTS.connection,
  group: WHATSAPP_EVENTS.group,
  presence: WHATSAPP_EVENTS.presence,
};

export function OnWhatsApp(event: WhatsAppEventType): MethodDecorator {
  return On(EVENT_MAP[event]);
}

/** @deprecated Use `OnWhatsApp('connection')` instead. */
export const LEGACY_EVENT_MAP: Record<Exclude<WhatsAppEventType, 'message' | 'status'>, string> = {
  connection: LEGACY_WHATSAPP_EVENTS.connection,
  group: LEGACY_WHATSAPP_EVENTS.group,
  presence: LEGACY_WHATSAPP_EVENTS.presence,
};
