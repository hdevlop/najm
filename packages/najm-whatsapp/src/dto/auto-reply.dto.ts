import { z } from 'zod';

export const CreateAutoReplyRuleDto = z.object({
  pattern: z.string().min(1).max(500),
  response: z.string().min(1).max(4000),
  matchType: z.enum(['exact', 'prefix', 'regex']).default('exact'),
  enabled: z.boolean().optional(),
});

export type CreateAutoReplyRuleDto = z.infer<typeof CreateAutoReplyRuleDto>;

export const UpdateAutoReplyRuleDto = z.object({
  pattern: z.string().min(1).max(500).optional(),
  response: z.string().min(1).max(4000).optional(),
  matchType: z.enum(['exact', 'prefix', 'regex']).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateAutoReplyRuleDto = z.infer<typeof UpdateAutoReplyRuleDto>;
