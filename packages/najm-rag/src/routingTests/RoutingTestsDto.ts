import { z } from 'zod';

export const routingTestIdParam = z.object({
  id: z.string().min(1),
});

export type RoutingTestIdParam = z.infer<typeof routingTestIdParam>;

export const routingTestLang = z.string().min(1).max(32).default('und');

export const createRoutingTestDto = z.object({
  name: z.string().min(1).max(200),
  query: z.string().min(1).max(2000),
  lang: routingTestLang.optional(),
  expectedTools: z.array(z.string().min(1)).min(1),
});

export const updateRoutingTestDto = z.object({
  name: z.string().min(1).max(200).optional(),
  query: z.string().min(1).max(2000).optional(),
  lang: z.string().min(1).max(32).optional(),
  expectedTools: z.array(z.string().min(1)).min(1).optional(),
});

export const importRoutingTestsDto = z.object({
  tests: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    query: z.string().min(1),
    lang: z.string().min(1).max(32).optional(),
    expectedTools: z.array(z.string().min(1)).min(1),
  })),
  mode: z.enum(['append', 'replace']).optional().default('append'),
});

export type CreateRoutingTestDto = z.infer<typeof createRoutingTestDto>;
export type UpdateRoutingTestDto = z.infer<typeof updateRoutingTestDto>;
export type ImportRoutingTestsDto = z.infer<typeof importRoutingTestsDto>;

export type RoutingTestStatus = 'pending' | 'pass' | 'fail' | 'low_confidence';

export interface RoutingTestScore {
  toolName: string;
  similarity: number;
  matchLevel: string;
}

export interface PaginatedRoutingTestsResponse {
  items: RoutingTestRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface RoutingTestRow {
  id: string;
  name: string;
  query: string;
  lang: string;
  expectedTools: string[];
  lastStatus: RoutingTestStatus;
  lastConfidence: number | null;
  lastActualTools: string[] | null;
  lastMissingTools: string[] | null;
  lastScores: RoutingTestScore[] | null;
  lastRunAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
