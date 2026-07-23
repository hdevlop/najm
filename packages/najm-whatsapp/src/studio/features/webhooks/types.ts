// owner: webhooks (used by settings)

export interface Webhook {
  id: string;
  url: string;
  events?: string[] | null;
  headers?: Record<string, string> | null;
  instanceId?: string | null;
  enabled?: boolean;
}