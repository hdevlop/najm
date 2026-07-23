import { Service, Log } from 'najm-api';
import { On } from 'najm-event';
import type { WhatsAppIncomingMessage, WhatsAppStatusEvent } from 'najm-whatsapp';

@Service()
export class WhatsAppListener {
  @Log() private log!: any;

  @On('whatsapp.message')
  async onMessage(msg: WhatsAppIncomingMessage) {
    this.log.info('[wa] message', { from: msg.from, text: msg.text, type: msg.type });
  }

  @On('whatsapp.status')
  async onStatus(evt: WhatsAppStatusEvent) {
    this.log.info('[wa] status', { to: evt.from, status: evt.status });
  }
}
