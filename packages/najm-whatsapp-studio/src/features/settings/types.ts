// owner: settings (used by webhooks)

export interface StudioSettings {
  sessions: { driver: string; path?: string };
  webhooks: number;
  defaultAgent?: string;
}