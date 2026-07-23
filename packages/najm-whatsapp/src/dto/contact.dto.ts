import { z } from 'zod';
import { jidSchema } from './jid';

export const ContactDto = z.object({
  jid: jidSchema,
  name: z.string().optional(),
  phone: z.string().optional(),
});

export type ContactDto = z.infer<typeof ContactDto>;
