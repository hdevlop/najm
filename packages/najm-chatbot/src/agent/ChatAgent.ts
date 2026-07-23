import { Service, Inject, Meta, DI, type Container } from 'najm-core';
import { streamText, generateText, appendResponseMessages, StreamData } from 'ai';
import type { UIMessage } from 'ai';
import { calculateCost, type UsageCost } from './modelPricing';
import { USER } from 'najm-guard';
import { McpRegistryService, McpBuilderService, TOOL_PROVIDER, type ToolProvider } from 'najm-mcp';
import { CHATBOT_CONFIG, CHATBOT_CONTEXT_PROVIDER, CHATBOT_ROUTING_PREVIEW_PROVIDER, type ChatbotContextProvider, type ChatbotRoutingPreviewProvider } from '../tokens';
import type { ChatbotConfig } from '../ChatbotPlugin';
import { AiSettingsService } from '../ai-settings/AiSettingsService';
import { buildModel, type LlmSettings, type LlmProvider } from './LlmProviderFactory';
import { buildAiSdkTools } from './McpToolAdapter';
import { truncatePreview } from './previewTruncate';
import {
  CacheConversationStore,
  DbConversationStore,
  type ConversationStore,
} from '../sessions/ConversationStore';
import { ChatLogRepository, type RoutingStatus } from '../chatLogs';

export type ChatChannel = 'web' | 'whatsapp' | string;

export interface ChatAgentInput {
  messages: UIMessage[];
  sessionKey?: string;
  channel?: ChatChannel;
}

export interface ChatAgentTrace {
  provider: string;
  model: string;
  routedTools: Array<{ name: string; description: string }>;
  semanticMatches: Array<{ toolName: string; similarity: number; source?: string; matchLevel?: string }>;
  dependencies: Array<{ toolName: string; reason: string }>;
  confirmations: Array<{ toolName: string; level: string; message?: string }>;
  knowledgeChunks: Array<{ chunkId: string; documentId: string; text: string; score: number; source?: string | null }>;
  knowledgeUsed: boolean;
  thresholds?: { maxTools: number; topSemanticHits: number; similarityThreshold: number };
  fallbackReason?: string;
}

export interface ChatDebugTraceOptions {
  maxToolResultPreviewChars?: number;
  maxDepth?: number;
  maxArrayItems?: number;
  redactKeys?: string[];
}

export interface ChatDebugRequest {
  message?: string;
  messages?: Array<{ id?: string; role: 'system' | 'user' | 'assistant'; content: string }>;
  sessionKey?: string;
  includeKnowledge?: boolean;
  includeRouting?: boolean;
  includeToolCalls?: boolean;
  traceOptions?: ChatDebugTraceOptions;
}

export type ChatDebugWarningCode =
  | 'MISSING_ROUTED_TOOL_CALL'
  | 'EXPECTED_KNOWLEDGE_EMPTY'
  | 'LOW_ROUTING_CONFIDENCE'
  | 'MUTATING_TOOL_BLOCKED'
  | 'TOOL_RESULT_TRUNCATED';

export interface ChatDebugWarning {
  code: ChatDebugWarningCode;
  message: string;
}

export interface ChatDebugToolCall {
  toolName: string;
  args: unknown;
  status: 'success' | 'error' | 'blocked';
  resultPreview?: unknown;
  error?: string;
}

export interface ChatDebugResponse {
  answer: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  routing?: {
    status: string;
    finalTools: string[];
    matches: Array<{ toolName: string; similarity: number; matchLevel: string }>;
    confirmations: Array<{ toolName: string; level: string; message?: string }>;
    dependencies: Array<{ toolName: string; reason: string }>;
  };
  knowledge?: {
    used: boolean;
    chunks: Array<{ chunkId: string; documentId: string; text: string; score: number; source?: string | null }>;
  };
  toolCalls?: ChatDebugToolCall[];
  warnings?: ChatDebugWarning[];
}

export interface ChatDebugError {
  error: string;
  code: 'AI_DISABLED' | 'NO_PROVIDER' | 'NO_MODEL' | 'NO_TOOLS' | 'ROUTER_ERROR' | 'PROVIDER_ERROR';
  setup?: {
    needsProvider: boolean;
    needsModel: boolean;
    needsApiKey: boolean;
  };
}

export interface ChatAgentDebugInput extends ChatAgentInput {
  traceOptions?: ChatDebugTraceOptions;
}

function getLatestUserText(messages: UIMessage[]): string {
  const latest = [...messages].reverse().find((message) => message.role === 'user');
  if (!latest) return '';
  return getMessageText(latest);
}

const toolPromptTokenCache = new WeakMap<object, number>();

function estimateToolPromptTokens(tool: any): number {
  if (tool && typeof tool === 'object') {
    const cached = toolPromptTokenCache.get(tool);
    if (typeof cached === 'number') return cached;
  }
  const parameters = tool?.validationArgs ?? [];
  const text = JSON.stringify({
    name: tool?.name,
    description: tool?.description,
    parameters,
  });
  const estimate = Math.ceil(text.length / 4);
  if (tool && typeof tool === 'object') {
    toolPromptTokenCache.set(tool, estimate);
  }
  return estimate;
}

async function settleWrites(writes: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(writes);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure) throw failure.reason;
}

export function getMessageText(message: UIMessage): string {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content as any)) {
    return (message.content as any[])
      .filter((p: any) => p?.type === 'text')
      .map((p: any) => p.text ?? '')
      .join('');
  }
  if (Array.isArray((message as any).parts)) {
    return (message as any).parts
      .filter((p: any) => p?.type === 'text')
      .map((p: any) => p.text ?? '')
      .join('');
  }
  return '';
}

function getMessageIdentity(message: UIMessage): string | null {
  if (message.id) return String(message.id);
  const text = getMessageText(message).trim();
  if (!text) return null;
  return `${message.role}:${text.slice(0, 200)}`;
}

@Service()
@Meta({ layer: 'plugin', order: 50 })
export class ChatAgent {
  @DI() private container!: Container;

  constructor(
    private settingsService: AiSettingsService,
    private dbStore: DbConversationStore,
    private cacheStore: CacheConversationStore,
    @Inject(CHATBOT_CONFIG) private config: ChatbotConfig,
    private chatLogRepository: ChatLogRepository,
  ) {}

  async stream(input: ChatAgentInput): Promise<Response> {
    const { channel = 'web', sessionKey } = input;

    const settings = await this.settingsService.getInternal();
    if (!settings || !settings.isEnabled) {
      return Response.json(
        { error: 'AI assistant is disabled in settings. Enable it in ⚙️ settings.' },
        { status: 503 },
      );
    }

    const useStatelessHistory =
      settings.useMemory === false ||
      this.shouldUseStatelessHistory(settings);

    const storedHistory = useStatelessHistory ? [] : await this.loadStoredHistory(input);
    const sessionMessages = this.mergeSessionMessages(storedHistory, input.messages);
    const routingText = this.buildRoutingQuery(sessionMessages);
    const promptMessages = useStatelessHistory
      ? input.messages
      : this.buildPromptMessages(sessionMessages, settings.maxPromptMessages ?? this.config.maxPromptMessages);

    const { model, system, tools, routingStatus, routedToolNames } = await this.prepare(
      channel,
      routingText,
      settings,
    );

    const data = new StreamData();
    const result = streamText({
      model: model!,
      system,
      messages: promptMessages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      maxSteps: this.config.maxSteps ?? 10,
      onFinish: async ({ response, steps, usage }) => {
        const userText = getLatestUserText(input.messages);
        const cost = this.computeUsageCost(settings, usage);
        if (cost) {
          data.appendMessageAnnotation({ type: 'token-usage', ...cost });
        }

        const writes: Promise<void>[] = [
          this.logChat(sessionKey, userText, routingStatus, routedToolNames, steps),
        ];
        if (!useStatelessHistory) {
          writes.push(this.saveSession(sessionKey, sessionMessages, response.messages, channel, {
            skip: false,
            maxStoredMessages: settings.maxStoredMessages ?? this.config.maxStoredMessages,
          }));
        }

        try {
          await settleWrites(writes);
        } finally {
          await data.close();
        }
      },
    });

    return result.toDataStreamResponse({ data });
  }

  async runOnce(input: ChatAgentInput): Promise<string> {
    const { channel = 'web', sessionKey } = input;

    const settings = await this.settingsService.getInternal();
    if (!settings || !settings.isEnabled) return 'AI assistant is currently disabled.';

    const useStatelessHistory =
      settings.useMemory === false ||
      this.shouldUseStatelessHistory(settings);

    const storedHistory = useStatelessHistory ? [] : await this.loadStoredHistory(input);
    const sessionMessages = this.mergeSessionMessages(storedHistory, input.messages);
    const routingText = this.buildRoutingQuery(sessionMessages);
    const promptMessages = useStatelessHistory
      ? input.messages
      : this.buildPromptMessages(sessionMessages, settings.maxPromptMessages ?? this.config.maxPromptMessages);

    const { model, system, tools, routingStatus, routedToolNames } = await this.prepare(
      channel,
      routingText,
      settings,
    );

    const result = await generateText({
      model: model!,
      system,
      messages: promptMessages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      maxSteps: this.config.maxSteps ?? 10,
    });

    const userText = getLatestUserText(input.messages);
    const writes: Promise<void>[] = [
      this.logChat(sessionKey, userText, routingStatus, routedToolNames, result.steps),
    ];
    if (!useStatelessHistory) {
      writes.push(this.saveSession(sessionKey, sessionMessages, result.response.messages, channel, {
        skip: false,
        maxStoredMessages: settings.maxStoredMessages ?? this.config.maxStoredMessages,
      }));
    }
    await settleWrites(writes);

    return result.text;
  }

  async debugRun(input: ChatAgentDebugInput): Promise<ChatDebugResponse | ChatDebugError> {
    const { channel = 'web', sessionKey, traceOptions } = input;

    const startMs = Date.now();

    const settings = await this.settingsService.getInternal();
    if (!settings || !settings.isEnabled) {
      return {
        error: 'AI assistant is disabled in settings.',
        code: 'AI_DISABLED',
        setup: { needsProvider: false, needsModel: false, needsApiKey: false },
      };
    }

    const useStatelessHistory =
      settings.useMemory === false ||
      this.shouldUseStatelessHistory(settings);

    const storedHistory = useStatelessHistory ? [] : await this.loadStoredHistory(input);
    const sessionMessages = this.mergeSessionMessages(storedHistory, input.messages);
    const routingText = this.buildRoutingQuery(sessionMessages);
    const promptMessages = useStatelessHistory
      ? input.messages
      : this.buildPromptMessages(sessionMessages, settings.maxPromptMessages ?? this.config.maxPromptMessages);

    let model: ReturnType<typeof this.buildModel> | null;
    let system: string;
    let tools: Record<string, any>;
    let routingStatus: RoutingStatus;
    let routedToolNames: string[];

    try {
      const prepared = await this.prepare(channel, routingText, settings);
      model = prepared.model;
      system = prepared.system;
      tools = prepared.tools;
      routingStatus = prepared.routingStatus;
      routedToolNames = prepared.routedToolNames;
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Provider error',
        code: 'PROVIDER_ERROR',
      };
    }

    const trace = await this.buildTrace(routingText, settings, this.getMcpTools(), routedToolNames, routingStatus);

    if (!model) {
      return {
        error: 'No model configured.',
        code: 'NO_MODEL',
        setup: { needsProvider: false, needsModel: true, needsApiKey: false },
      };
    }

    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({
        model: model,
        system,
        messages: promptMessages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        maxSteps: this.config.maxSteps ?? 10,
      });
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Provider error',
        code: 'PROVIDER_ERROR',
      };
    }

    const userText = getLatestUserText(input.messages);
    const writes: Promise<void>[] = [
      this.logChat(sessionKey, userText, routingStatus, routedToolNames, result.steps),
    ];
    if (!useStatelessHistory) {
      writes.push(this.saveSession(sessionKey, sessionMessages, result.response.messages, channel, {
        skip: false,
        maxStoredMessages: settings.maxStoredMessages ?? this.config.maxStoredMessages,
      }));
    }
    await settleWrites(writes);

    const toolCalls: ChatDebugToolCall[] = [];
    const allToolCalls = result.steps.flatMap((step: any) => step.toolCalls ?? []);
    const actualToolNames = allToolCalls
      .map((call: any) => call.toolName ?? call.function?.name ?? call.name)
      .filter(Boolean);

    const toolResultMap = new Map<string, any>();
    for (const step of result.steps) {
      for (const tr of step.toolResults ?? []) {
        const id = tr?.toolCallId ?? tr?.id;
        if (id) toolResultMap.set(id, tr);
      }
    }

    const routedSet = new Set(routedToolNames);
    const routingThreshold = trace?.thresholds?.similarityThreshold ?? 0.45;

    const truncationOpts = traceOptions ? {
      maxChars: traceOptions.maxToolResultPreviewChars,
      maxDepth: traceOptions.maxDepth,
      maxArrayItems: traceOptions.maxArrayItems,
      redactKeys: traceOptions.redactKeys,
    } : undefined;

    for (const step of result.steps) {
      for (const rawCall of step.toolCalls ?? []) {
        const toolCall = rawCall as any;
        const name = toolCall.toolName ?? toolCall.function?.name ?? toolCall.name;
        const args = toolCall.args ?? toolCall.input ?? {};
        let status: ChatDebugToolCall['status'] = 'success';
        let resultPreview: unknown;
        let error: string | undefined;

        const matchedResult = toolResultMap.get(toolCall.toolCallId ?? toolCall.id);

        if (toolCall.isConfirmationBlocked || toolCall.confirmationRequired) {
          status = 'blocked';
          resultPreview = truncatePreview(matchedResult?.result ?? args, truncationOpts);
        } else if (matchedResult && matchedResult.isError) {
          status = 'error';
          error = typeof matchedResult.result === 'string'
            ? matchedResult.result
            : matchedResult.result?.message ?? 'Unknown error';
          resultPreview = truncatePreview(matchedResult.result, truncationOpts);
        } else {
          const toolResult = matchedResult?.result ?? toolCall.result ?? toolCall.output ?? {};
          const truncated = truncatePreview(toolResult, truncationOpts);
          resultPreview = truncated;
          if (truncated && typeof truncated === 'object' && 'truncated' in truncated) {
            toolCalls.push({ toolName: name, args, status, resultPreview: truncated, error });
            continue;
          }
        }

        toolCalls.push({ toolName: name, args, status, resultPreview, error });
      }
    }

    const warnings: ChatDebugWarning[] = [];

    if (routedSet.size > 0 && actualToolNames.length === 0) {
      warnings.push({ code: 'MISSING_ROUTED_TOOL_CALL', message: 'Routing selected tools but model made no tool calls.' });
    }

    if (trace) {
      const belowThreshold = trace.semanticMatches.filter((m) => m.similarity < routingThreshold);
      const aboveThreshold = trace.semanticMatches.filter((m) => m.similarity >= routingThreshold);
      if (belowThreshold.length > 0 && aboveThreshold.length > 0) {
        warnings.push({ code: 'LOW_ROUTING_CONFIDENCE', message: 'Some routing matches are below the confidence threshold.' });
      } else if (belowThreshold.length > 0 && aboveThreshold.length === 0 && trace.semanticMatches.length > 0) {
        warnings.push({ code: 'LOW_ROUTING_CONFIDENCE', message: 'All routing matches are below the confidence threshold.' });
      }

      if (trace.knowledgeChunks.length === 0 && trace.knowledgeUsed) {
        warnings.push({ code: 'EXPECTED_KNOWLEDGE_EMPTY', message: 'Knowledge context was enabled but no chunks were retrieved.' });
      }

      const hasBlockedTool = toolCalls.some((tc) => tc.status === 'blocked');
      if (hasBlockedTool) {
        warnings.push({ code: 'MUTATING_TOOL_BLOCKED', message: 'A mutating tool was blocked or requires confirmation.' });
      }
    }

    const wasTruncated = toolCalls.some(
      (tc) => tc.resultPreview && typeof tc.resultPreview === 'object' && 'truncated' in tc.resultPreview,
    );
    if (wasTruncated) {
      warnings.push({ code: 'TOOL_RESULT_TRUNCATED', message: 'Some tool results were truncated.' });
    }

    const latencyMs = Date.now() - startMs;
    let returnedSessionKey: string | undefined;
    if (sessionKey) {
      returnedSessionKey = sessionKey;
    }

    const routing: ChatDebugResponse['routing'] | undefined = trace ? {
      status: routingStatus,
      finalTools: routedToolNames,
      matches: trace.semanticMatches.map((m) => ({
        toolName: m.toolName,
        similarity: m.similarity,
        matchLevel: m.matchLevel ?? 'secondary',
      })),
      confirmations: trace.confirmations,
      dependencies: trace.dependencies,
    } : undefined;

    const knowledge: ChatDebugResponse['knowledge'] | undefined = trace ? {
      used: trace.knowledgeUsed,
      chunks: trace.knowledgeChunks,
    } : undefined;

    return {
      answer: result.text,
      sessionKey: returnedSessionKey,
      provider: trace?.provider,
      model: trace?.model,
      latencyMs,
      routing,
      knowledge,
      toolCalls,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  async clearSession(sessionKey: string): Promise<void> {
    await this.getConversationStore().clear(sessionKey);
  }

  private async prepare(channel: ChatChannel, userText: string, settings: { provider: LlmProvider; model?: string; systemPrompt?: string; apiKey?: string | null; baseUrl?: string | null; isEnabled?: boolean }) {
    const llmSettings: LlmSettings = {
      provider: settings.provider,
      apiKey: settings.apiKey ?? null,
      baseUrl: settings.baseUrl ?? null,
      model: settings.model ?? 'llama3.1',
    };

    const model = this.buildModel(llmSettings);

    let tools: Record<string, any> = {};
    let routingStatus: RoutingStatus = 'disabled';
    let routedToolNames: string[] = [];

    const toolsOverride = this.config.tools;
    const mcp = this.getMcpTools();

    if (toolsOverride === 'none') {
      tools = {};
    } else if (toolsOverride === 'all') {
      if (!mcp) {
        throw new Error('chatbot({ tools: "all" }) requires the najm-mcp plugin.');
      }
      tools = this.buildChatTools(mcp.builder, mcp.registry.tools);
    } else {
      const router = this.tryGetRouter();
      if (router) {
        const routerResult = await router.findRelevantTools(userText);
        routingStatus = routerResult.status;
        routedToolNames = routerResult.tools.map((t) => t.name);
        if (mcp && routerResult.tools.length > 0) {
          tools = this.buildChatTools(mcp.builder, routerResult.tools);
        }
      } else if (mcp) {
        tools = this.buildChatTools(mcp.builder, mcp.registry.tools);
      }
    }

    const toolWarning =
      !mcp || mcp.registry.tools.length === 0
        ? '\n\n⚠️ WARNING: No MCP tools were found. Answer from general knowledge only.'
        : '';

    const channelPrompt = this.config.systemPromptByChannel?.[channel as 'web' | 'whatsapp'];
    let system =
      channelPrompt ?? settings.systemPrompt ?? this.config.defaultSystemPrompt ?? '';

    if (this.config.context !== 'none') {
      const contextParts: string[] = [];
      for (const provider of this.tryGetContextProviders()) {
        const ctx = await provider.getContext(userText);
        if (ctx) contextParts.push(ctx);
      }
      if (contextParts.length > 0) {
        system = contextParts.join('\n\n') + '\n\n' + system;
      }
    }

    return {
      model,
      system: system + toolWarning,
      tools,
      routingStatus,
      routedToolNames,
    };
  }

  protected buildModel(settings: LlmSettings) {
    return buildModel(settings);
  }

  private computeUsageCost(
    settings: { provider: string; model?: string },
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
  ): (UsageCost & { provider: string; model: string }) | null {
    if (!usage) return null;
    const promptTokens = Number(usage.promptTokens ?? 0);
    const completionTokens = Number(usage.completionTokens ?? 0);
    if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
    if (promptTokens === 0 && completionTokens === 0) return null;

    const provider = settings.provider;
    const model = settings.model ?? 'llama3.1';
    const cost = calculateCost(provider, model, promptTokens, completionTokens);
    return { ...cost, provider, model };
  }

  private buildChatTools(builder: McpBuilderService, tools: any[]) {
    return buildAiSdkTools(builder, tools, {
      blockConfirmationTools: true,
      readOnlyMessage: (tool) => this.getReadOnlyToolMessage(tool),
    });
  }

  private getReadOnlyToolMessage(tool: { name: string; confirmation?: { message?: string } }): string {
    const baseMessage = this.translate(
      'assistant.security.readOnlyMode',
      'For safety, this assistant can currently read and search data only. Actions that create, update, delete, checkout, assign, remove, or clear data will be available after confirmation approval is added.',
    );
    const confirmationMessage = tool.confirmation?.message
      ? this.translate(tool.confirmation.message, tool.confirmation.message)
      : null;

    return confirmationMessage
      ? `${baseMessage}\n\n${tool.name}: ${confirmationMessage}`
      : baseMessage;
  }

  private translate(key: string, fallback: string): string {
    try {
      const i18n = this.container.get(Symbol.for('I18nService')) as { t?: (key: string) => string } | undefined;
      const translated = i18n?.t?.(key);
      return translated || fallback;
    } catch {
      return fallback;
    }
  }

  private shouldUseStatelessHistory(settings: { provider: string; model?: string }): boolean {
    const provider = settings.provider.toLowerCase();
    const model = (settings.model ?? '').toLowerCase();

    return model.includes('deepseek') && (
      provider === 'opencode'
      || provider === 'openrouter'
      || provider === 'custom'
    );
  }

  private async loadStoredHistory(input: ChatAgentInput): Promise<UIMessage[]> {
    if (!input.sessionKey) return [];
    const previous = await this.getConversationStore().load(input.sessionKey);
    return previous ?? [];
  }

  private mergeSessionMessages(history: UIMessage[], current: UIMessage[]): UIMessage[] {
    const result: UIMessage[] = [];
    const seen = new Set<string>();
    for (const message of [...history, ...current]) {
      const key = getMessageIdentity(message);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      result.push(message);
    }
    return result;
  }

  private buildRoutingQuery(messages: UIMessage[]): string {
    const n = this.config.routingHistoryMessages ?? 2;
    const userTurns = messages
      .filter((m) => m.role === 'user')
      .map(getMessageText)
      .filter(Boolean);
    return userTurns.slice(-(n + 1)).join('\n---\n');
  }

  private buildPromptMessages(messages: UIMessage[], maxPromptMessages?: number | null): UIMessage[] {
    const limit = maxPromptMessages ?? this.config.maxPromptMessages ?? 10;
    if (!limit || limit < 1) return messages;
    return messages.slice(-limit);
  }

  private trimStoredMessages(messages: UIMessage[], maxStoredMessages?: number | null): UIMessage[] {
    if (!maxStoredMessages || maxStoredMessages < 1) return messages;
    return messages.slice(-maxStoredMessages);
  }

  private async saveSession(
    sessionKey: string | undefined,
    messages: UIMessage[],
    responseMessages: any[],
    channel: ChatChannel,
    options: { skip?: boolean; maxStoredMessages?: number | null } = {},
  ): Promise<void> {
    if (options.skip || !sessionKey) return;

    const updatedMessages = appendResponseMessages({
      messages: messages as any,
      responseMessages,
    }) as UIMessage[];

    const isNewSession = messages.length === 0
      || (messages.every((m) => m.role !== 'user') === false && messages.filter((m) => m.role === 'user').length <= 1);
    let title: string | null = null;
    if (isNewSession) {
      const firstUserMsg = updatedMessages.find((m) => m.role === 'user');
      if (firstUserMsg) {
        title = getMessageText(firstUserMsg).slice(0, 60).trim() || null;
      }
    }

    const storedMessages = this.trimStoredMessages(updatedMessages, options.maxStoredMessages);

    await this.getConversationStore().save(sessionKey, storedMessages, {
      userId: this.getCurrentUserId(),
      channel,
      title,
    });
  }

  private async logChat(
    sessionKey: string | undefined,
    userText: string,
    routingStatus: RoutingStatus,
    routedToolNames: string[],
    steps: any[],
  ): Promise<void> {
    if (this.config.chatLogging?.enabled !== true) return;

    const allToolCalls = steps.flatMap((step: any) => step.toolCalls ?? []);
    const actualToolNames = allToolCalls
      .map((call: any) => call.toolName ?? call.function?.name ?? call.name)
      .filter(Boolean);

    const registry = this.getMcpTools()?.registry;
    const registryByName = new Map<string, any>(
      registry?.tools.map((tool: any) => [tool.name, tool]) ?? [],
    );
    const tokenEstimate = routedToolNames.reduce((sum, name) => {
      const tool = registryByName.get(name);
      if (!tool) return sum;
      return sum + estimateToolPromptTokens(tool);
    }, 0);

    try {
      await this.chatLogRepository.insert({
        sessionKey: sessionKey ?? null,
        userQuery: userText,
        routingEnabled: this.config.toolRouting?.enabled === true,
        routingStatus,
        routedTools: routedToolNames.length ? routedToolNames : null,
        actualToolNames: actualToolNames.length ? actualToolNames : null,
        modelToolCalls: allToolCalls.length ? allToolCalls : null,
        metadata: { toolPromptTokenEstimate: tokenEstimate },
      });
    } catch {
      // Logging failures must not break chat
    }
  }

  private getConversationStore(): ConversationStore {
    return this.config.conversationStore === 'cache' ? this.cacheStore : this.dbStore;
  }

  private getCurrentUserId(): string | null {
    try {
      const user = this.container.get(USER);
      return user?.id ? String(user.id) : null;
    } catch {
      return null;
    }
  }

  private getMcpTools(): { registry: McpRegistryService; builder: McpBuilderService } | null {
    try {
      return {
        registry: this.container.get(McpRegistryService),
        builder: this.container.get(McpBuilderService),
      };
    } catch {
      return null;
    }
  }

  private tryGetRouter(): ToolProvider | null {
    try {
      return this.container.get(TOOL_PROVIDER);
    } catch {
      return null;
    }
  }

  private tryGetContextProviders(): ChatbotContextProvider[] {
    try {
      const providers = this.container.get(CHATBOT_CONTEXT_PROVIDER);
      return Array.isArray(providers) ? providers : providers ? [providers] : [];
    } catch {
      return [];
    }
  }

  private tryGetRoutingPreviewProvider(): ChatbotRoutingPreviewProvider | null {
    try {
      return this.container.get(CHATBOT_ROUTING_PREVIEW_PROVIDER);
    } catch {
      return null;
    }
  }

  private async buildTrace(
    userText: string,
    settings: { provider: string; model?: string },
    mcp: { registry: McpRegistryService } | null,
    routedToolNames: string[],
    routingStatus: RoutingStatus,
  ): Promise<ChatAgentTrace> {
    const provider = this.tryGetRoutingPreviewProvider();
    const contextProviders = this.tryGetContextProviders();

    let semanticMatches: ChatAgentTrace['semanticMatches'] = [];
    let dependencies: ChatAgentTrace['dependencies'] = [];
    let confirmations: ChatAgentTrace['confirmations'] = [];
    let thresholds: ChatAgentTrace['thresholds'];
    let fallbackReason: string | undefined;

    if (provider) {
      try {
        const preview = await provider.previewRouting(userText);
        semanticMatches = preview.matches.map((m) => ({
          toolName: m.toolName,
          similarity: m.similarity,
          source: m.source,
          matchLevel: m.matchLevel,
        }));
        dependencies = preview.dependencies;
        confirmations = preview.confirmations;
        thresholds = preview.config ? {
          maxTools: preview.config.maxTools,
          topSemanticHits: preview.config.topSemanticHits,
          similarityThreshold: preview.config.similarityThreshold,
        } : undefined;
        if (preview.error) {
          fallbackReason = preview.error;
        } else if (preview.status === 'fallback_all') {
          fallbackReason = 'fallback_on_no_match';
        } else if (preview.status === 'fallback_none') {
          fallbackReason = 'no_match';
        }
      } catch {
        // preview failed, trace continues without routing data
      }
    }

    let knowledgeChunks: ChatAgentTrace['knowledgeChunks'] = [];
    let knowledgeUsed = false;
    for (const cp of contextProviders) {
      if (cp.getContextTrace) {
        try {
          const trace = await cp.getContextTrace(userText);
          if (trace) {
            knowledgeUsed = knowledgeUsed || trace.used;
            if (trace.chunks.length > 0) {
              knowledgeChunks = trace.chunks;
            }
          }
        } catch {
          // context trace failed, continue without it
        }
      }
    }

    const routedTools: ChatAgentTrace['routedTools'] = [];
    if (mcp) {
      for (const name of routedToolNames) {
        const tool = mcp.registry.tools.find((t) => t.name === name);
        if (tool) {
          routedTools.push({ name: tool.name, description: tool.description ?? '' });
        }
      }
    }

    return {
      provider: settings.provider,
      model: settings.model ?? 'llama3.1',
      routedTools,
      semanticMatches,
      dependencies,
      confirmations,
      knowledgeChunks,
      knowledgeUsed,
      thresholds,
      fallbackReason,
    };
  }
}
