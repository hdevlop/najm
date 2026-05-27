import { z } from 'zod';

export const updateRoutingSettingsSchema = z.object({
  enableKnowledge: z.boolean().optional(),
  maxTools: z.number().int().positive().optional(),
  topSemanticHits: z.number().int().positive().optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  fallbackOnRouterError: z.enum(['all', 'none']).optional(),
  fallbackOnNoMatch: z.enum(['all', 'none']).optional(),
  allowedLangs: z.array(z.string().trim().min(1)).optional(),
  dependencies: z.record(z.string(), z.array(z.string())).optional(),
  toolsOverride: z.enum(['auto', 'none', 'all']).optional(),
  contextOverride: z.enum(['auto', 'none']).optional(),
});

export type UpdateRoutingSettingsDto = z.infer<typeof updateRoutingSettingsSchema>;

export interface EffectiveRoutingSettings {
  enableKnowledge: boolean;
  maxTools: number;
  topSemanticHits: number;
  similarityThreshold: number;
  fallbackOnRouterError: 'all' | 'none';
  fallbackOnNoMatch: 'all' | 'none';
  allowedLangs?: string[];
  dependencies: Record<string, string[]>;
  toolsOverride: 'auto' | 'none' | 'all';
  contextOverride: 'auto' | 'none';
  source: 'boot' | 'db';
}

export const restartRequiredFields = [
  'embeddingProvider',
  'embeddingModel',
  'embeddingDimensions',
  'vectorDriver',
  'dialect',
] as const;
