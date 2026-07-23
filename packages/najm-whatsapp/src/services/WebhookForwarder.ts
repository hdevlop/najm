/**
 * WebhookForwarder — fans runtime events out to configured webhooks and logs
 * each delivery to `whatsapp_webhook_events`.
 *
 * Configured webhooks come from two sources:
 *   - `BAILEYS_CONFIG.webhooks` (static, set when the plugin is built)
 *   - dynamic CRUD via `WebhookService` (per-instance subscriptions)
 *
 * Each delivery is signed with HMAC-SHA256 when `webhookSigningSecret` is set,
 * and each URL is checked against the SSRF policy in `webhookSecurity`.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { lookup } from 'dns/promises';
import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { On } from 'najm-event';
import { DB } from 'najm-database';
import { BAILEYS_CONFIG, WA_SCHEMA } from '../tokens';
import { WebhookService } from './WebhookService';
import {
  WHATSAPP_EVENTS,
  type WhatsAppMessageEvent,
  type WebhookFilterEvent,
  WEBHOOK_FILTER_EVENTS,
} from '../events';

export interface WebhookConfig {
  url: string;
  events?: string[];
  headers?: Record<string, string>;
  instanceId?: string;
  /** When set, overrides the global signing secret for this target. */
  signingSecret?: string;
}

export interface WebhookSecurityConfig {
  allowPrivateNetworks?: boolean;
  allowedHosts?: string[];
}

const PROTECTED_HEADERS = new Set([
  'content-type',
  'x-najm-signature-256',
  'x-najm-delivery-id',
  'x-najm-timestamp',
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 88 && parts[2] === 99) return true; // 6to4 anycast
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function expandMappedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase().split('%')[0];
  const prefix = '::ffff:';
  if (!lower.startsWith(prefix)) return null;
  const tail = lower.slice(prefix.length);
  // Dotted-quad form: ::ffff:127.0.0.1
  if (tail.includes('.')) return tail;
  // Hex form: ::ffff:7f00:1
  const groups = tail.split(':');
  if (groups.length !== 2) return null;
  const hi = parseInt(groups[0], 16);
  const lo = parseInt(groups[1], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateIpv6(ip: string): boolean {
  // URL.hostname may preserve IPv6 brackets depending on the runtime.
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  if (lower.startsWith('ff')) return true; // multicast
  // IPv4-mapped IPv6 must be evaluated against IPv4 private ranges.
  const mapped = expandMappedIpv4(lower);
  if (mapped && isPrivateIpv4(mapped)) return true;
  return false;
}

export interface UrlCheckResult {
  ok: boolean;
  reason?: string;
}

export async function assertSafeUrl(rawUrl: string, security?: WebhookSecurityConfig): Promise<UrlCheckResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'scheme_not_allowed' };
  }
  if (security?.allowedHosts && security.allowedHosts.length > 0) {
    if (!security.allowedHosts.includes(url.hostname)) {
      return { ok: false, reason: 'host_not_allowed' };
    }
  }
  if (security?.allowPrivateNetworks) return { ok: true };
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  // Literal IP?
  if (/^[\d.]+$/.test(hostname) && isPrivateIpv4(hostname)) {
    return { ok: false, reason: 'private_ip' };
  }
  if (hostname.includes(':') && isPrivateIpv6(hostname)) {
    return { ok: false, reason: 'private_ip' };
  }
  // DNS resolve
  try {
    const records = await lookup(hostname, { all: true });
    for (const r of records) {
      if (isPrivateIpv4(r.address) || isPrivateIpv6(r.address)) {
        return { ok: false, reason: 'dns_private_ip' };
      }
    }
  } catch (err: any) {
    return { ok: false, reason: `dns_lookup_failed:${err?.code ?? err?.message ?? 'unknown'}` };
  }
  return { ok: true };
}

@Service()
@Meta({ layer: 'plugin' })
export class WebhookForwarder {
  @Inject(BAILEYS_CONFIG) private config!: { webhooks?: WebhookConfig[]; webhookSigningSecret?: string; webhookSecurity?: WebhookSecurityConfig };
  @Inject(WebhookService) private webhooks!: WebhookService;
  @Inject(LoggerService) private log?: LoggerService;
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
        signingSecret: d.signingSecret ?? undefined,
      })),
    ];

    const body = JSON.stringify({
      eventType,
      instanceId: instanceId ?? null,
      payload,
      timestamp: new Date().toISOString(),
    });
    const deliveryId = randomUUID();
    const globalSecret = this.config.webhookSigningSecret;

    const t = this.schema.whatsappWebhookEvents;
    const perTarget: Array<{ url: string; webhookId: string | null; status: 'sent' | 'failed'; error?: string }> = [];

    for (const hook of hooks) {
      const hookId = dynamic.find((d) => d.url === hook.url)?.id ?? null;
      const secret = hook.signingSecret ?? globalSecret;
      const ok = await this.deliverWithRetry(hook, body, deliveryId, secret);
      perTarget.push({ url: hook.url, webhookId: hookId, status: ok.ok ? 'sent' : 'failed', error: ok.error });
    }

    const overall = perTarget.every((p) => p.status === 'sent')
      ? 'sent'
      : perTarget.some((p) => p.status === 'sent')
        ? 'partial'
        : 'failed';

    if (t) {
      try {
        await this.db.insert(t).values({
          instanceId: instanceId ?? null,
          eventType,
          payload: JSON.stringify({ ...payload, _delivery: { id: deliveryId, targets: perTarget } }),
          forwardStatus: overall,
          createdAt: new Date().toISOString(),
        });
      } catch (err: any) {
        this.log?.warn?.(`[najm-whatsapp] webhook event log failed: ${err?.message ?? err}`);
      }
    }
  }

  /**
   * Deliver a test event to a single URL.
   * Used by `POST /wa-studio/webhooks/test`; respects SSRF policy and signs
   * the body when a signing secret is configured.
   */
  async deliverTest(url: string, eventType: string, payload: Record<string, unknown> = { test: true }): Promise<{ status: 'sent' | 'failed'; error?: string }> {
    const body = JSON.stringify({
      eventType,
      instanceId: null,
      payload,
      timestamp: new Date().toISOString(),
    });
    const deliveryId = randomUUID();
    const result = await this.deliverWithRetry(
      { url, events: [eventType] },
      body,
      deliveryId,
      this.config.webhookSigningSecret,
    );
    return result.ok ? { status: 'sent' } : { status: 'failed', error: result.error };
  }

  /**
   * One delivery loop, including SSRF, signature, and protected-headers logic.
   */
  private async deliverWithRetry(
    hook: WebhookConfig,
    body: string,
    deliveryId: string,
    signingSecret: string | undefined,
  ): Promise<{ ok: boolean; error?: string }> {
    const security = this.config.webhookSecurity;
    const safety = await assertSafeUrl(hook.url, security);
    if (!safety.ok) {
      this.log?.warn?.(`[najm-whatsapp] webhook url rejected: ${hook.url} (${safety.reason})`);
      return { ok: false, error: safety.reason };
    }

    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Najm-Delivery-Id': deliveryId,
      'X-Najm-Timestamp': String(Math.floor(Date.now() / 1000)),
    };
    if (signingSecret) {
      const sig = createHmac('sha256', signingSecret).update(body).digest('hex');
      baseHeaders['X-Najm-Signature-256'] = `sha256=${sig}`;
    }

    // User-supplied headers may NOT override protected ones.
    const userHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(hook.headers ?? {})) {
      if (!PROTECTED_HEADERS.has(k.toLowerCase())) {
        userHeaders[k] = v;
      }
    }
    const headers = { ...userHeaders, ...baseHeaders };

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(5_000),
          redirect: 'manual',
        });
        if (res.ok) return { ok: true };
        if (res.status >= 400 && res.status < 500) {
          return { ok: false, error: `http_${res.status}` };
        }
      } catch (err: any) {
        if (attempt === 1) {
          return { ok: false, error: err?.message ?? 'fetch_error' };
        }
      }
    }
    return { ok: false, error: 'retry_exhausted' };
  }

  // ============================================================================
  // Event handlers — drive the public pipeline from runtime events.
  // ============================================================================

  @On(WHATSAPP_EVENTS.message)
  async onMessage(event: WhatsAppMessageEvent) {
    try { await this.forward('message', event, event?.instanceId); }
    catch (err: any) { this.log?.warn?.(`[najm-whatsapp] webhook message forward failed: ${err?.message ?? err}`); }
  }

  @On(WHATSAPP_EVENTS.connection)
  async onConnection(event: any) {
    try { await this.forward('connection', event, event?.instanceId); }
    catch (err: any) { this.log?.warn?.(`[najm-whatsapp] webhook connection forward failed: ${err?.message ?? err}`); }
  }

  @On(WHATSAPP_EVENTS.status)
  async onStatus(event: any) {
    try { await this.forward('status', event, event?.instanceId); }
    catch (err: any) { this.log?.warn?.(`[najm-whatsapp] webhook status forward failed: ${err?.message ?? err}`); }
  }

  @On(WHATSAPP_EVENTS.group)
  async onGroup(event: any) {
    try { await this.forward('group', event, event?.instanceId); }
    catch (err: any) { this.log?.warn?.(`[najm-whatsapp] webhook group forward failed: ${err?.message ?? err}`); }
  }

  @On(WHATSAPP_EVENTS.presence)
  async onPresence(event: any) {
    try { await this.forward('presence', event, event?.instanceId); }
    catch (err: any) { this.log?.warn?.(`[najm-whatsapp] webhook presence forward failed: ${err?.message ?? err}`); }
  }
}

// Re-export so consumers can verify the signature.
export function verifyWebhookSignature(body: string, header: string | null | undefined, secret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = header.slice('sha256='.length);
  const computed = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}

export const _internal = { isPrivateIpv4, isPrivateIpv6, WEBHOOK_FILTER_EVENTS };
export type { WebhookFilterEvent };
