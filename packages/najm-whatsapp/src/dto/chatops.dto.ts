import { z } from 'zod';
import { jidSchema } from './jid';

export const ChatOpsDto = z.object({
  instanceId: z.string().min(1),
  jid: jidSchema,
  archive: z.boolean().optional(),
  pin: z.boolean().optional(),
});

export type ChatOpsDto = z.infer<typeof ChatOpsDto>;

export const MuteDto = z.object({
  instanceId: z.string().min(1),
  jid: jidSchema,
  duration: z.number().int().nullable().optional(),
});

export type MuteDto = z.infer<typeof MuteDto>;
