// owner: settings (used by webhooks)

export interface StudioSettings {
  sessions: { driver: string; path?: string };
  /** Total webhook count (static config + dynamic subscribers). */
  webhooks: number;
  /** Dynamic subscribers only. */
  webhookCount: number;
  /** Static config array length only. */
  staticWebhookCount: number;
  defaultAgent?: string;
}