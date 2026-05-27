import { z } from 'zod';

export const studioAssistantChatDto = z.object({
  workspace: z.string().min(1),
  message: z.string().min(1),
  sessionId: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type StudioAssistantChatDto = z.infer<typeof studioAssistantChatDto>;