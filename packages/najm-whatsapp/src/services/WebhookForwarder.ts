import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { BAILEYS_CONFIG, WA_SCHEMA } from '../tokens';
import { WebhookService } from './WebhookService';

export interface WebhookConfig {
  url: string;
  events?: string[];
  headers?: Record<string, string>;
  instanceId?: string;
}

@Service()
@Meta({ layer: 'plugin' })
export class WebhookForwarder {
  @Inject(BAILEYS_CONFIG) private config!: { webhooks?: WebhookConfig[] };
  @Inject(WebhookService) private webhooks!: WebhookService;
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  async forward(eventType: string, payload: any, instanceId?: string): Promise<void> {
    const dynamic = await this.webhooks.listForEvent(eventType, instanceId);
    const fromConfig = (this.config.webhooks ?? []).filter((hook) => {
      if (hook.instanceId && instanceId && hook.instanceId !== instanceId) return false;
      if (hook.events && hook.events.length > 0 && !hook.events.includes(eventType)) return false;
      return true;
    });

    const hooks: WebhookConfig[] = [
      ...fromConfig,
      ...dynamic.map<WebhookConfig>((d) => ({
        url: d.url,
        events: d.events ?? undefined,
        headers: d.headers ?? undefined,
        instanceId: d.instanceId ?? undefined,
      })),
    ];

    const body = JSON.stringify({
      eventType,
      instanceId,
      payload,
      timestamp: new Date().toISOString(),
    });
    let failed = false;

    for (const hook of hooks) {
      const ok = await this.deliverWithRetry(hook, body);
      if (!ok) failed = true;
    }

    const t = this.schema.whatsappWebhookEvents;
    await this.db.insert(t).values({
      instanceId: instanceId ?? null,
      eventType,
      payload: JSON.stringify(payload),
      forwardStatus: failed ? 'failed' : 'sent',
      createdAt: new Date().toISOString(),
    });
  }

  private async deliverWithRetry(hook: WebhookConfig, body: string): Promise<boolean> {
    const headers = { 'Content-Type': 'application/json', ...(hook.headers || {}) };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(5_000),
        });
        if (res.ok) return true;
        if (res.status >= 400 && res.status < 500) return false;
      } catch {
        // retry once
      }
    }
    return false;
  }
}
