import { z } from 'zod';

export const TestWebhookDto = z.object({
  url: z.string().url(),
  eventType: z.string().min(1),
});

export type TestWebhookDto = z.infer<typeof TestWebhookDto>;

export const CreateWebhookDto = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  instanceId: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

export type CreateWebhookDto = z.infer<typeof CreateWebhookDto>;

export const UpdateWebhookDto = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  instanceId: z.string().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
});

export type UpdateWebhookDto = z.infer<typeof UpdateWebhookDto>;
