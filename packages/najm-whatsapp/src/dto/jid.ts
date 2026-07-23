import { z } from 'zod';

/**
 * WhatsApp JID format: <digits>@(s.whatsapp.net|g.us|broadcast|lid).
 * Some JIDs include a device suffix `:N` before the @ — accept that too.
 */
const JID_REGEX = /^\d+(:\d+)?@(s\.whatsapp\.net|g\.us|broadcast|lid)$/;

export const jidSchema = z
  .string()
  .min(1)
  .regex(JID_REGEX, 'Invalid WhatsApp JID (expected <digits>@s.whatsapp.net | g.us | broadcast | lid)');
