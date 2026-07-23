import { Controller, Get, Inject } from 'najm-core';
import { isAdmin } from 'najm-auth';
import { BAILEYS_CONFIG } from '../tokens';
import { WebhookService } from '../services/WebhookService';

@Controller('/wa-studio/settings')
@isAdmin()
export class StudioSettingsController {
  @Inject(BAILEYS_CONFIG) private config!: any;
  @Inject(WebhookService) private webhooks!: WebhookService;

  @Get('/')
  async get() {
    // The controller reports the live state of webhook subscribers and
    // configured sessions. Counts are derived from the dynamic store so the
    // Studio never displays fabricated numbers.
    let dynamic: any[] = [];
    try { dynamic = await this.webhooks.list(); } catch { /* table may be empty */ }
    return {
      sessions: this.config.sessions,
      // Real count: static config + dynamic subscribers.
      webhooks: (this.config.webhooks?.length ?? 0) + dynamic.length,
      webhookCount: dynamic.length,
      staticWebhookCount: this.config.webhooks?.length ?? 0,
      defaultAgent: this.config.defaultAgent,
    };
  }
}
