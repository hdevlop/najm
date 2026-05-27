import { On } from 'najm-event';

export type WhatsAppEventType = 'message' | 'status' | 'connection' | 'group' | 'presence';

const EVENT_MAP: Record<WhatsAppEventType, string> = {
  message: 'whatsapp.message',
  status: 'whatsapp.status',
  connection: 'wa.connection_update',
  group: 'wa.groups.update',
  presence: 'wa.presence.update',
};

export function OnWhatsApp(event: WhatsAppEventType): MethodDecorator {
  return On(EVENT_MAP[event]);
}
