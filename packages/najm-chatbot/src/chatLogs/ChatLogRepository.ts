import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { CHATBOT_SCHEMA } from '../tokens';
import type { ChatbotSchema } from '../ai-settings/AiSettingsRepository';

export type RoutingStatus =
  | 'disabled'
  | 'routed'
  | 'fallback_all'
  | 'fallback_none'
  | 'router_error';

export interface InsertChatLogInput {
  sessionKey?: string | null;
  userQuery: string;
  queryLang?: string | null;
  routingEnabled: boolean;
  routingStatus: RoutingStatus;
  routedTools?: string[] | null;
  actualToolNames?: string[] | null;
  modelToolCalls?: Record<string, unknown>[] | null;
  modelAnswer?: string | null;
  stepsCount?: number | null;
  success?: boolean | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Repository()
export class ChatLogRepository {
  @DB() declare db: any;
  @Inject(CHATBOT_SCHEMA) private schema!: ChatbotSchema;

  private get table() {
    const table = this.schema.chatbotInteractionLogs;
    if (!table) throw new Error('chatbot_interaction_logs schema missing');
    return table;
  }

  async insert(input: InsertChatLogInput): Promise<void> {
    await this.db.insert(this.table).values({
      sessionKey: input.sessionKey ?? null,
      userQuery: input.userQuery,
      queryLang: input.queryLang ?? null,
      routingEnabled: input.routingEnabled,
      routingStatus: input.routingStatus,
      routedTools: input.routedTools ?? null,
      actualToolNames: input.actualToolNames ?? null,
      modelToolCalls: input.modelToolCalls ?? null,
      modelAnswer: input.modelAnswer ?? null,
      stepsCount: input.stepsCount?.toString() ?? null,
      success: input.success ?? null,
      error: input.error ?? null,
      metadata: input.metadata ?? null,
    });
  }
}
