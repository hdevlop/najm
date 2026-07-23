import { z } from 'zod';

export const oauthStartQuery = z.object({
  returnTo: z.string().optional(),
});

export const oauthCallbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export type OAuthStartQuery = z.infer<typeof oauthStartQuery>;
export type OAuthCallbackQuery = z.infer<typeof oauthCallbackQuery>;
