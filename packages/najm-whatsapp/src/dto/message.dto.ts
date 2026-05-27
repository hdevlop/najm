import { z } from 'zod';
import { jidSchema } from './jid';

export const SendMessageDto = z.object({
  instanceId: z.string().min(1),
  jid: jidSchema,
  text: z.string().min(1),
  options: z.record(z.string(), z.any()).optional(),
});

export type SendMessageDto = z.infer<typeof SendMessageDto>;

export const HistoryRequestDto = z.object({
  instanceId: z.string().min(1),
  jid: jidSchema,
  count: z.number().int().min(1).max(100),
});

export type HistoryRequestDto = z.infer<typeof HistoryRequestDto>;
