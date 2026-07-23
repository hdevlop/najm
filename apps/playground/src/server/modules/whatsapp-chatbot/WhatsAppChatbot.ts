import { Service, DI, type Container, Log } from 'najm-api';
import { OnWhatsApp } from 'najm-whatsapp';
import type { WhatsAppIncomingMessage } from 'najm-whatsapp';
import { WhatsAppService } from 'najm-whatsapp';
import { ChatAgent } from 'najm-chatbot';
import { UserRepository } from 'najm-auth';
import { runAsUser } from 'najm-auth';

const COMMANDS = {
  help: `/help — Show available commands
/reset — Clear your conversation history
/stop — Disable WhatsApp chatbot replies`,
  reset: 'Conversation history cleared.',
  stop: 'WhatsApp chatbot stopped. Send any message to resume.',
  resume: 'WhatsApp chatbot resumed.',
} as const;

@Service()
export class WhatsAppChatbot {
  @DI() private container!: Container;
  @Log() private log!: any;
  private stopped = new Set<string>();

  constructor(
    private agent: ChatAgent,
    private wa: WhatsAppService,
    private users: UserRepository,
  ) {}

  @OnWhatsApp('message')
  async onMessage(msg: WhatsAppIncomingMessage) {
    const { from, text } = msg;

    try {
      const user = await this.users.findByPhone(from);
      if (!user) {
        await this.wa.sendText(from, 'Please link your phone via /auth/link-phone first.');
        return;
      }

      const command = text?.trim().toLowerCase();
      if (command?.startsWith('/')) {
        await this.handleCommand(command, from);
        return;
      }

      if (this.stopped.has(from)) {
        this.stopped.delete(from);
        await this.wa.sendText(from, COMMANDS.resume);
        return;
      }

      await this.wa.sendTyping(from, msg.messageId);

      await runAsUser(this.container, user, async () => {
        const reply = await this.agent.runOnce({
          messages: [{
            id: msg.messageId,
            role: 'user' as const,
            content: text,
            parts: [{ type: 'text' as const, text }],
          }],
          sessionKey: `wa:${from}`,
          channel: 'whatsapp',
        });
        await this.wa.sendText(from, reply);
      });
    } catch (err: any) {
      this.log.error?.(`WhatsApp chatbot error for ${from}: ${err.message}`);
      await this.wa.sendText(from, 'Sorry, something went wrong. Please try again later.').catch(() => {});
    }
  }

  private async handleCommand(command: string, from: string): Promise<void> {
    const cmd = command.split(' ')[0] as keyof typeof COMMANDS;

    switch (cmd) {
      case 'help':
        await this.wa.sendText(from, COMMANDS.help);
        break;
      case 'reset':
        await this.agent.clearSession(`wa:${from}`);
        await this.wa.sendText(from, COMMANDS.reset);
        break;
      case 'stop':
        this.stopped.add(from);
        await this.wa.sendText(from, COMMANDS.stop);
        break;
      default:
        await this.wa.sendText(from, `Unknown command: ${command}\n\n${COMMANDS.help}`);
    }
  }
}
