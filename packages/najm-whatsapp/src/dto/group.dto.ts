import { z } from 'zod';

export const CreateGroupDto = z.object({
  instanceId: z.string().min(1),
  subject: z.string().min(1),
  participants: z.array(z.string().min(1)).min(1),
});

export type CreateGroupDto = z.infer<typeof CreateGroupDto>;

export const UpdateParticipantsDto = z.object({
  participants: z.array(z.string().min(1)).min(1),
  action: z.enum(['add', 'remove', 'promote', 'demote']),
});

export type UpdateParticipantsDto = z.infer<typeof UpdateParticipantsDto>;

export const GroupSettingsDto = z.object({
  setting: z.enum(['announcement', 'not_announcement', 'locked', 'unlocked']),
});

export type GroupSettingsDto = z.infer<typeof GroupSettingsDto>;
