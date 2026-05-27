import { z } from 'zod';

export const LLM_PROVIDER_ENUM = z.enum([
  'anthropic',
  'openai',
  'google',
  'zai',
  'opencode',
  'openrouter',
  'minimax',
  'qwen',
  'ollama',
  'custom',
]);
export type LlmProvider = z.infer<typeof LLM_PROVIDER_ENUM>;

const aiSettingsFields = z.object({
  provider: LLM_PROVIDER_ENUM,
  apiKey: z.string().max(500).optional().nullable(),
  baseUrl: z.string().max(500).optional().nullable(),
  model: z.string().min(1).max(200),
  modelOptions: z.array(z.string().min(1).max(200)).max(100).optional(),
  systemPrompt: z.string().max(2000).optional().nullable(),
  isEnabled: z.boolean(),
  useMemory: z.boolean(),
  maxStoredMessages: z.number().int().min(1).max(10000).optional().nullable(),
  maxPromptMessages: z.number().int().min(1).max(2000).optional().nullable(),
});

export const createAiSettingsDto = aiSettingsFields.extend({
  provider: LLM_PROVIDER_ENUM.default('ollama'),
  model: z.string().min(1).max(200).default('llama3.1'),
  isEnabled: z.boolean().default(true),
  useMemory: z.boolean().default(true),
  id: z.string().min(1).optional(),
});

export const updateAiSettingsDto = aiSettingsFields.partial();

export type CreateAiSettingsDto = z.infer<typeof createAiSettingsDto>;
export type UpdateAiSettingsDto = z.infer<typeof updateAiSettingsDto>;
