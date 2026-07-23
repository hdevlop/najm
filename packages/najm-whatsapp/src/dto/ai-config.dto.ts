import { z } from 'zod';

export const AiLimitsSchema = z.object({
  timeoutMs: z.number().int().positive().max(60_000).optional(),
  maxInputChars: z.number().int().positive().max(64_000).optional(),
  requestsPerMinute: z.number().int().positive().max(1000).optional(),
  requestsPerDay: z.number().int().positive().max(100_000).optional(),
}).optional();

export const SaveAiConfigDto = z.object({
  enabled: z.boolean(),
  provider: z.enum(['openai', 'anthropic']).optional(),
  model: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().max(4000).optional(),
  temperature: z.number().min(0).max(1).optional(),
  limits: AiLimitsSchema,
});

export type SaveAiConfigDto = z.infer<typeof SaveAiConfigDto>;

export interface AiLimits {
  timeoutMs: number;
  maxInputChars: number;
  requestsPerMinute: number;
  requestsPerDay: number;
}

export const AI_DEFAULT_LIMITS: AiLimits = {
  timeoutMs: 10_000,
  maxInputChars: 4_096,
  requestsPerMinute: 20,
  requestsPerDay: 500,
};
