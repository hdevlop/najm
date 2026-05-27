import { z } from 'zod';

export const SaveAiConfigDto = z.object({
  enabled: z.boolean(),
  provider: z.enum(['openai', 'anthropic']).optional(),
  model: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().max(4000).optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export type SaveAiConfigDto = z.infer<typeof SaveAiConfigDto>;
