import { Service, Inject, Meta, DI, CORRELATION_ID, type Container } from 'najm-core';
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, stepCountIs, streamText } from 'ai';
import type { UIMessage } from 'ai';
import { calculateCost, normalizeUsage, type ReportedUsage, type UsageCost } from './modelPricing';
import { USER } from 'najm-guard';
import { ChatDiagnosticsRecorder, summarizeUsage, type ChatDiagnostics, type ChatOutcome } from './ChatDiagnostics';
import { McpRegistryService, McpBuilderService, TOOL_PROVIDER, type ToolProvider } from 'najm-mcp';
import { CHATBOT_CONFIG, CHATBOT_CONTEXT_PROVIDER, CHATBOT_ROUTING_PREVIEW_PROVIDER, type ChatbotContextProvider, type ChatbotRoutingPreviewProvider } from '../tokens';
import type { ChatbotConfig } from '../ChatbotPlugin';
import { AiSettingsService } from '../ai-settings/AiSettingsService';
import { buildModel, type LlmSettings, type LlmProvider } from './LlmProviderFactory';
import { buildAiSdkTools, DEFAULT_READ_ONLY_MESSAGE } from './McpToolAdapter';
import { truncatePreview } from './previewTruncate';
import {
  CacheConversationStore,
  DbConversationStore,
  type ConversationStore,
} from '../sessions/ConversationStore';
import { ChatLogRepository, type RoutingStatus } from '../chatLogs';
import type { RagDiagnosticsRunner } from 'najm-rag';
import { replyLanguageInstruction, replyUnavailable } from './replyPolicy';
import { executeReplyTemplate, validateReplyTemplate, type TemplateCallResult } from './replyTemplate';
import { selectReplyPreparation } from './replyReadiness';
import type { ReplyPreparationContext, ReplyTemplate } from './replyPolicy';

export type ChatChannel = 'web' | 'whatsapp' | string;

export interface ChatAgentInput {
  messages: UIMessage[];
  sessionKey?: string;
  channel?: ChatChannel;
  signal?: AbortSignal;
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

function stepToolCalls(step: { toolCalls?: Array<{ toolName: string; input?: unknown }> }): string {
  return (step.toolCalls ?? [])
    .map((call) => `${call.toolName}:${JSON.stringify(call.input ?? null)}`)
    .sort()
    .join('\n');
}

/**
 * When the last two steps made exactly the same tool calls, the next step
 * answers without tools. A repeated call returns the same result, so a model
 * retrying a failing call would otherwise loop until `maxSteps` and end with
 * no answer.
 */
export function answerAfterRepeatedToolCall({ steps }: {
  steps: ReadonlyArray<{ toolCalls?: Array<{ toolName: string; input?: unknown }> }>;
}): { toolChoice: 'none' } | undefined {
  if (steps.length < 2) return undefined;
  const last = stepToolCalls(steps[steps.length - 1]);
  return last && last === stepToolCalls(steps[steps.length - 2]) ? { toolChoice: 'none' } : undefined;
}

async function settleWrites(writes: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(writes);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure) throw failure.reason;
}

export function getMessageText(message: UIMessage): string {
  const legacyContent = (message as any).content;
  if (typeof legacyContent === 'string') return legacyContent;
  if (Array.isArray(legacyContent)) {
    return legacyContent
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

function appendResponseMessages(messages: UIMessage[], responseMessages: any[]): UIMessage[] {
  const assistantMessages = responseMessages
    .filter((message) => message?.role === 'assistant')
    .map((message, messageIndex) => {
      const content = Array.isArray(message.content) ? message.content : [message.content];
      const parts = content.flatMap((part: any) => {
        if (typeof part === 'string') return [{ type: 'text', text: part }];
        if (part?.type === 'text') return [{ type: 'text', text: part.text ?? '' }];
        if (part?.type === 'tool-call') {
          return [{
            type: `tool-${part.toolName}`,
            toolCallId: part.toolCallId,
            state: 'input-available',
            input: part.input,
          }];
        }
        return [];
      });

      return {
        id: `assistant-${Date.now()}-${messageIndex}`,
        role: 'assistant',
        parts,
      } as UIMessage;
    });

  return [...messages, ...assistantMessages];
}

function normalizeUIMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (Array.isArray((message as any).parts)) return message;
    return {
      id: message.id ?? `message-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: message.role,
      parts: [{ type: 'text', text: getMessageText(message) }],
    } as UIMessage;
  });
}

async function toModelMessages(messages: UIMessage[]) {
  return convertToModelMessages(normalizeUIMessages(messages));
}

/** Passes a response body through unchanged, reporting a read error or a cancel by the client. */
function observeBody(response: Response, hooks: { error(error: unknown): void; cancel(reason: unknown): void }): Response {
  const source = response.body;
  if (!source) return response;
  const reader = source.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        hooks.error(error);
        controller.error(error);
      }
    },
    async cancel(reason) {
      hooks.cancel(reason);
      await reader.cancel(reason);
    },
  });
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function getMessageIdentity(message: UIMessage): string | null {
  if (message.id) return String(message.id);
  const text = getMessageText(message).trim();
  if (!text) return null;
  return `${message.role}:${text.slice(0, 200)}`;
}

/**
 * Placed before and after the system prompt when tool routing failed and
 * `fallbackOnRouterError: 'none'` left the model without tools, so it says the
 * data is unreachable instead of answering a data question from nothing. A
 * single closing line was not enough: with an app prompt that names its tools,
 * gpt-oss-120b wrote tool calls as text or said it was fetching the data.
 */
export const ROUTING_UNAVAILABLE_PROMPT =
  'TOOLS ARE OFFLINE FOR THIS MESSAGE. Tool lookup failed, so you have no tools in this turn, whatever other '
  + 'instructions say about tools. Do not write tool calls, tool names or JSON, and do not say you are retrieving '
  + 'anything. Do not answer questions about stored data from memory or guess figures. Reply briefly, in the '
  + "user's language, that the data cannot be reached right now and to try again in a moment. Greetings and "
  + 'questions that need no stored data can be answered normally.';

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
    const streamAbort = new AbortController();
    input = { ...input, signal: input.signal ? AbortSignal.any([input.signal, streamAbort.signal]) : streamAbort.signal };
    const { channel = 'web', sessionKey } = input;
    const userText = getLatestUserText(input.messages);
    const diagnostics = this.startDiagnostics(channel);
    const steps: any[] = [];
    const settle = (outcome: ChatOutcome, error?: unknown, persistence?: Promise<unknown> | null) =>
      this.settleChat(diagnostics, outcome, error, persistence, { sessionKey, userText, routedToolNames: turn?.routedToolNames ?? [], steps });

    let turn: Awaited<ReturnType<ChatAgent['prepareTurn']>>;
    try {
      turn = await this.prepareTurn(input, channel, diagnostics);
    } catch (error) {
      await settle(input.signal?.aborted ? 'aborted' : 'setup_error', error);
      throw error;
    }
    if (!turn) {
      return Response.json(
        { error: 'AI assistant is disabled in settings. Enable it in ⚙️ settings.' },
        { status: 503 },
      );
    }
    const { settings, useStatelessHistory, sessionMessages, promptMessages, model, system, tools } = turn;

    if (turn.templateReply) {
      await this.finishTemplate(input, turn, diagnostics);
      const reply = turn.templateReply;
      return createUIMessageStreamResponse({ stream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: 'start', messageId: crypto.randomUUID() });
          for (const call of reply.calls) {
            writer.write({ type: 'tool-input-available', toolCallId: call.id, toolName: call.name, input: call.input });
            writer.write({ type: 'tool-output-available', toolCallId: call.id, output: call.output });
          }
          writer.write({ type: 'text-start', id: 'reply' });
          writer.write({ type: 'text-delta', id: 'reply', delta: reply.text });
          writer.write({ type: 'text-end', id: 'reply' });
          writer.write({ type: 'finish', finishReason: 'stop', messageMetadata: diagnostics.data.cost ?? undefined });
        },
      }) });
    }

    let messages: Awaited<ReturnType<typeof toModelMessages>>;
    try {
      messages = await toModelMessages(promptMessages);
    } catch (error) {
      await settle(input.signal?.aborted ? 'aborted' : 'setup_error', error);
      throw error;
    }

    const result = streamText({
      abortSignal: input.signal,
      model: model!,
      system,
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(this.config.maxSteps ?? 10),
      prepareStep: answerAfterRepeatedToolCall,
      timeout: this.config.streamTimeout,
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') diagnostics.textDelta(chunk.text);
      },
      onStepFinish: (step) => {
        steps.push(step);
        diagnostics.step(step);
      },
      onError: async ({ error }) => {
        // Keeps the SDK's default report, which an onError option replaces.
        console.error(error);
        await settle(input.signal?.aborted ? 'aborted' : 'error', error);
      },
      onAbort: async () => {
        await settle('aborted');
      },
      onFinish: async ({ response, totalUsage }) => {
        if (diagnostics.isSettled || input.signal?.aborted) return;
        diagnostics.data.marks.finishMs = diagnostics.now();
        diagnostics.data.usage = summarizeUsage(totalUsage);
        diagnostics.data.cost = this.computeUsageCost(settings, totalUsage);

        const save = useStatelessHistory
          ? null
          : diagnostics.span('persistenceMs', () => this.saveSession(sessionKey, sessionMessages, response.messages, channel, {
            skip: false,
            maxStoredMessages: settings.maxStoredMessages ?? this.config.maxStoredMessages,
          }));
        await settleWrites([settle('completed', undefined, save), ...(save ? [save] : [])]);
      },
    });

    const response = result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => part.type === 'finish'
        ? this.computeUsageCost(settings, part.totalUsage) ?? undefined
        : undefined,
    });
    // A provider stream that throws reaches none of the SDK callbacks, and a
    // client disconnect reaches onAbort only with an abort signal; the body sees both.
    return observeBody(response, {
      error: (error) => { void settle('error', error).catch(() => {}); },
      cancel: () => { streamAbort.abort(); void settle('aborted').catch(() => {}); },
    });
  }

  async runOnce(input: ChatAgentInput): Promise<string> {
    const { channel = 'web', sessionKey } = input;
    const userText = getLatestUserText(input.messages);
    const diagnostics = this.startDiagnostics(channel);
    const steps: any[] = [];
    let routedToolNames: string[] = [];
    const settle = (outcome: ChatOutcome, error?: unknown, persistence?: Promise<unknown> | null) =>
      this.settleChat(diagnostics, outcome, error, persistence, { sessionKey, userText, routedToolNames, steps });

    let turn: Awaited<ReturnType<ChatAgent['prepareTurn']>>;
    try {
      turn = await this.prepareTurn(input, channel, diagnostics);
    } catch (error) {
      await settle(input.signal?.aborted ? 'aborted' : 'setup_error', error);
      throw error;
    }
    if (!turn) return 'AI assistant is currently disabled.';
    routedToolNames = turn.routedToolNames;
    const { settings, useStatelessHistory, sessionMessages, promptMessages, model, system, tools } = turn;

    if (turn.templateReply) {
      await this.finishTemplate(input, turn, diagnostics);
      return turn.templateReply.text;
    }

    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({
        abortSignal: input.signal,
        model: model!,
        system,
        messages: await toModelMessages(promptMessages),
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        stopWhen: stepCountIs(this.config.maxSteps ?? 10),
        prepareStep: answerAfterRepeatedToolCall,
        onStepFinish: (step) => {
          steps.push(step);
          diagnostics.step(step);
        },
      });
    } catch (error) {
      await settle(input.signal?.aborted ? 'aborted' : 'error', error);
      throw error;
    }

    input.signal?.throwIfAborted();
    diagnostics.data.marks.finishMs = diagnostics.now();
    diagnostics.data.usage = summarizeUsage(result.totalUsage);
    diagnostics.data.cost = this.computeUsageCost(settings, result.totalUsage);

    const save = useStatelessHistory
      ? null
      : diagnostics.span('persistenceMs', () => this.saveSession(sessionKey, sessionMessages, result.response.messages, channel, {
        skip: false,
        maxStoredMessages: settings.maxStoredMessages ?? this.config.maxStoredMessages,
      }));
    await settleWrites([settle('completed', undefined, save), ...(save ? [save] : [])]);

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
      const prepared = await this.prepareReply(input, channel, routingText, settings);
      model = prepared.model;
      system = prepared.system;
      tools = prepared.tools;
      routingStatus = prepared.routingStatus;
      routedToolNames = prepared.routedToolNames;
      if (prepared.templateReply) {
        input.signal?.throwIfAborted();
        if (!useStatelessHistory) await this.saveSession(sessionKey, sessionMessages,
          [{ role: 'assistant', content: prepared.templateReply.text }], channel,
          { maxStoredMessages: settings.maxStoredMessages ?? this.config.maxStoredMessages });
        return { answer: prepared.templateReply.text, sessionKey, provider: settings.provider,
          model: settings.model, latencyMs: Date.now() - startMs,
          toolCalls: prepared.templateReply.calls.map(call => ({
            toolName: call.name, args: truncatePreview(call.input, { redactKeys: traceOptions?.redactKeys }), status: 'success' as const,
            resultPreview: truncatePreview(call.output, { maxChars: traceOptions?.maxToolResultPreviewChars,
              maxDepth: traceOptions?.maxDepth, maxArrayItems: traceOptions?.maxArrayItems, redactKeys: traceOptions?.redactKeys }),
          })) };
      }
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
        abortSignal: input.signal,
        model: model,
        system,
        messages: await toModelMessages(promptMessages),
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        stopWhen: stepCountIs(this.config.maxSteps ?? 10),
        prepareStep: answerAfterRepeatedToolCall,
      });
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Provider error',
        code: 'PROVIDER_ERROR',
      };
    }

    if (input.signal?.aborted) return { error: 'Request aborted', code: 'PROVIDER_ERROR' };
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
        const id = tr?.toolCallId ?? (tr as any)?.id;
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

  /** Settings, history and preparation shared by stream() and runOnce(). Null when the assistant is disabled. */
  private async prepareTurn(input: ChatAgentInput, channel: ChatChannel, diagnostics: ChatDiagnosticsRecorder) {
    input.signal?.throwIfAborted();
    const settings = await diagnostics.span('settingsMs', () => this.settingsService.getInternal());
    if (!settings || !settings.isEnabled) return null;
    diagnostics.data.provider = settings.provider;
    diagnostics.data.model = settings.model ?? 'llama3.1';

    const useStatelessHistory =
      settings.useMemory === false ||
      this.shouldUseStatelessHistory(settings);

    const storedHistory = useStatelessHistory
      ? []
      : await diagnostics.span('historyMs', () => this.loadStoredHistory(input));
    const sessionMessages = this.mergeSessionMessages(storedHistory, input.messages);
    const routingText = this.buildRoutingQuery(sessionMessages);
    const promptMessages = useStatelessHistory
      ? input.messages
      : this.buildPromptMessages(sessionMessages, settings.maxPromptMessages ?? this.config.maxPromptMessages);
    diagnostics.data.messages = { stored: storedHistory.length, prompt: promptMessages.length };

    const prepare = () => diagnostics.span('prepareMs', () => this.prepareReply(input, channel, routingText, settings, diagnostics));
    // Resolve an optional public bridge; chat still works without the RAG package/plugin.
    const ragDiagnostics = this.tryGetRagDiagnostics();
    const prepared = await (ragDiagnostics ? diagnostics.rag(ragDiagnostics, prepare) : prepare());
    diagnostics.data.routingStatus = prepared.routingStatus;
    diagnostics.data.routedToolCount = prepared.routedToolNames.length;

    return { settings, useStatelessHistory, sessionMessages, promptMessages, ...prepared };
  }

  private startDiagnostics(channel: ChatChannel): ChatDiagnosticsRecorder {
    let correlationId: string | null = null;
    try {
      correlationId = this.container.get(CORRELATION_ID) ?? null;
    } catch {
      // Outside a request scope (scripts, tests).
    }
    return new ChatDiagnosticsRecorder({ channel, correlationId });
  }

  /**
   * Records the terminal outcome once. The log row is written alongside the
   * session save, so it carries no persistenceMs; the sink is called after
   * both and does.
   */
  private async settleChat(
    diagnostics: ChatDiagnosticsRecorder,
    outcome: ChatOutcome,
    error: unknown,
    persistence: Promise<unknown> | null | undefined,
    entry: { sessionKey?: string; userText: string; routedToolNames: string[]; steps: any[] },
  ): Promise<void> {
    if (!diagnostics.settle(outcome, error)) return;
    const data = diagnostics.data;
    await this.logChat(entry.sessionKey, entry.userText, data.routingStatus ?? 'disabled', entry.routedToolNames, entry.steps, data);
    const sink = this.config.chatLogging?.onDiagnostics;
    if (!sink) return;
    await persistence?.catch(() => {});
    try {
      await sink(data);
    } catch {
      // A diagnostics sink must not break chat.
    }
  }

  /** Async candidates are opt-in; the synchronous policy retains precedence. */
  private async prepareReply(input: ChatAgentInput, channel: ChatChannel, routingText: string,
    settings: Parameters<ChatAgent['prepare']>[2], diagnostics?: ChatDiagnosticsRecorder) {
    input.signal?.throwIfAborted();
    const policy = this.config.reply?.preparation;
    const userText = getLatestUserText(input.messages);
    if (policy?.enabled !== true) return this.prepare(channel, routingText, settings, diagnostics, userText, false, input.signal);
    const language = this.config.reply?.detectLanguage?.(userText) ?? null;
    const request = { userText, language, channel, userId: this.getCurrentUserId(), sessionKey: input.sessionKey };
    const mcp = this.getMcpTools();
    const available = this.config.tools === 'none' ? [] : mcp?.registry.tools ?? [];
    const execute = async (template: ReplyTemplate) => {
      input.signal?.throwIfAborted();
      const label = typeof template.label === 'string' ? { label: template.label.slice(0, 128) } : {};
      if (diagnostics) diagnostics.data.reply = { source: 'template', language, ...label };
      let templateReply: { text: string; calls: TemplateCallResult[] };
      try { templateReply = await executeReplyTemplate(template, available, mcp?.builder ?? null,
        event => diagnostics?.tool(event), input.signal); }
      catch {
        input.signal?.throwIfAborted();
        templateReply = { text: replyUnavailable(language), calls: [] };
        if (diagnostics) diagnostics.data.reply = { source: 'template', language, error: true, ...label };
      }
      return { model: null, system: '', tools: {}, routingStatus: 'disabled' as RoutingStatus,
        routedToolNames: templateReply.calls.map(call => call.name), templateReply };
    };
    const synchronous = this.config.reply?.template?.({ userText, language, channel });
    if (synchronous) return execute(synchronous);
    let context: ReplyPreparationContext = { historyComplete: false, priorUserTurns: null };
    try {
      const resolved = policy.resolveContext?.(request);
      if (resolved && typeof (resolved as any).then === 'function') void Promise.resolve(resolved).catch(() => {});
      if (resolved?.historyComplete === true && Number.isSafeInteger(resolved.priorUserTurns) && resolved.priorUserTurns! >= 0)
        context = { historyComplete: true, priorUserTurns: resolved.priorUserTurns };
    } catch { /* Unknown history is deliberately ineligible for first-turn policies. */ }
    const selected = await selectReplyPreparation({ policy, request: { ...request, ...context }, signal: input.signal,
      onSelection: event => {
        if (!diagnostics) return;
        diagnostics.data.replyPreparation = { ...event };
        // A losing router may still have an unabortable embedding request.
        if (event.selected === 'template' && event.losingWorkMayContinue && diagnostics.data.embeddings) diagnostics.data.embeddingsIncomplete = true;
      },
      valid: template => { validateReplyTemplate(template, available, mcp?.builder ?? null); return true; },
      ordinary: signal => this.prepare(channel, routingText, settings, diagnostics, userText, true, signal),
      ordinaryToolNames: value => Object.keys(value.tools) });
    return selected.kind === 'template' ? execute(selected.value) : selected.value;
  }

  private async prepare(
    channel: ChatChannel,
    userText: string,
    settings: { provider: LlmProvider; model?: string; systemPrompt?: string; apiKey?: string | null; baseUrl?: string | null; isEnabled?: boolean },
    diagnostics?: ChatDiagnosticsRecorder,
    latestUserText = userText,
    skipTemplate = false,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
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
      tools = this.buildChatTools(mcp.builder, mcp.registry.tools, diagnostics);
    } else {
      const router = this.tryGetRouter();
      if (router) {
        const findTools = () => router.findRelevantTools(userText);
        const routerResult = diagnostics ? await diagnostics.span('routingMs', findTools, signal) : await findTools();
        signal?.throwIfAborted();
        routingStatus = routerResult.status;
        routedToolNames = routerResult.tools.map((t) => t.name);
        if (mcp && routerResult.tools.length > 0) {
          tools = this.buildChatTools(mcp.builder, routerResult.tools, diagnostics);
        }
      } else if (mcp) {
        tools = this.buildChatTools(mcp.builder, mcp.registry.tools, diagnostics);
      }
    }

    const routingUnavailable = !!mcp && mcp.registry.tools.length > 0
      && routingStatus === 'router_error' && Object.keys(tools).length === 0;
    const toolWarning =
      !mcp || mcp.registry.tools.length === 0
        ? '\n\n⚠️ WARNING: No MCP tools were found. Answer from general knowledge only.'
        : routingUnavailable
          ? `\n\n${ROUTING_UNAVAILABLE_PROMPT}`
          : '';

    const channelPrompt = this.config.systemPromptByChannel?.[channel as 'web' | 'whatsapp'];
    let system =
      channelPrompt ?? settings.systemPrompt ?? this.config.defaultSystemPrompt ?? '';

    if (this.config.context !== 'none') {
      const contextParts: string[] = [];
      const collect = async () => {
        for (const provider of this.tryGetContextProviders()) {
          signal?.throwIfAborted();
          const ctx = await provider.getContext(userText, { latestUserText, channel });
          signal?.throwIfAborted();
          if (ctx) contextParts.push(ctx);
        }
      };
      if (diagnostics) await diagnostics.span('contextMs', collect, signal);
      else await collect();
      if (contextParts.length > 0) {
        system = contextParts.join('\n\n') + '\n\n' + system;
      }
    }

    signal?.throwIfAborted();
    const language = this.config.reply?.detectLanguage?.(latestUserText) ?? null;
    const instruction = replyLanguageInstruction(language);
    if (instruction) system += `\n\n${instruction}`;
    let templateReply: { text: string; calls: TemplateCallResult[] } | null = null;
    const template = skipTemplate ? null : this.config.reply?.template?.({ userText: latestUserText, language, channel });
    if (template) {
      const label = typeof template.label === 'string' ? { label: template.label.slice(0, 128) } : {};
      if (diagnostics) diagnostics.data.reply = { source: 'template', language, ...label };
      try {
        templateReply = await executeReplyTemplate(template,
          mcp?.registry.tools.filter(tool => Object.hasOwn(tools, tool.name)) ?? [], mcp?.builder ?? null,
          event => diagnostics?.tool(event), signal);
      } catch {
        signal?.throwIfAborted();
        // No fallback generation or partial-count guess after a failed read.
        templateReply = { text: replyUnavailable(language), calls: [] };
        if (diagnostics) diagnostics.data.reply = { source: 'template', language, error: true, ...label };
      }
    } else if (this.config.reply && diagnostics) diagnostics.data.reply = { source: 'model', language };

    signal?.throwIfAborted();
    return {
      model,
      // The notice also leads, ahead of instructions about using tools.
      system: (routingUnavailable ? `${ROUTING_UNAVAILABLE_PROMPT}\n\n` : '') + system + toolWarning,
      tools,
      routingStatus,
      routedToolNames,
      templateReply,
    };
  }

  private async finishTemplate(input: ChatAgentInput,
    turn: NonNullable<Awaited<ReturnType<ChatAgent['prepareTurn']>>>, diagnostics: ChatDiagnosticsRecorder) {
    input.signal?.throwIfAborted();
    const reply = turn.templateReply!;
    diagnostics.textDelta(reply.text);
    diagnostics.data.marks.finishMs = diagnostics.now();
    diagnostics.data.usage = summarizeUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    diagnostics.data.cost = { provider: turn.settings.provider, model: turn.settings.model ?? 'llama3.1',
      promptTokens: 0, completionTokens: 0, totalTokens: 0, inputCost: 0, outputCost: 0,
      totalCost: 0, currency: 'USD', pricingFound: true };
    const save = turn.useStatelessHistory ? null : diagnostics.span('persistenceMs', () => this.saveSession(
      input.sessionKey, turn.sessionMessages, [{ role: 'assistant', content: reply.text }], input.channel ?? 'web',
      { maxStoredMessages: turn.settings.maxStoredMessages ?? this.config.maxStoredMessages }));
    await settleWrites([this.settleChat(diagnostics, 'completed', undefined, save,
      { sessionKey: input.sessionKey, userText: getLatestUserText(input.messages), routedToolNames: turn.routedToolNames, steps: [] }),
      ...(save ? [save] : [])]);
  }

  protected buildModel(settings: LlmSettings) {
    return buildModel(settings, { openrouter: this.config.openrouter });
  }

  private computeUsageCost(
    settings: { provider: string; model?: string },
    usage: ReportedUsage | undefined,
  ): (UsageCost & { provider: string; model: string }) | null {
    const counts = normalizeUsage(usage);
    if (!counts) return null;

    const provider = settings.provider;
    const model = settings.model ?? 'llama3.1';
    const cost = calculateCost(provider, model, counts.promptTokens, counts.completionTokens);
    return { ...cost, provider, model };
  }

  private buildChatTools(builder: McpBuilderService, tools: any[], diagnostics?: ChatDiagnosticsRecorder) {
    const built = buildAiSdkTools(builder, tools, {
      blockConfirmationTools: true,
      readOnlyMessage: (tool) => this.getReadOnlyToolMessage(tool),
      onToolSettled: diagnostics ? (event) => diagnostics.tool(event) : undefined,
    });
    const runner = diagnostics ? this.tryGetRagDiagnostics() : undefined;
    if (runner && diagnostics) {
      for (const tool of Object.values(built)) {
        const execute = tool.execute;
        // Keep the MCP request/authorization scope, while tracing any embeddings
        // performed by a tool after preparation (including streamed LLM steps).
        tool.execute = (args: any, callOptions: any) => diagnostics.rag(runner, () => execute(args, callOptions));
      }
    }
    return built;
  }

  private tryGetRagDiagnostics(): RagDiagnosticsRunner | undefined {
    try { return this.container.get(Symbol.for('najm:rag:diagnostics')); }
    catch { return undefined; /* Older RAG releases and apps without RAG have no bridge. */ }
  }

  private getReadOnlyToolMessage(tool: { name: string; confirmation?: { message?: string } }): string {
    const baseMessage = this.translate(
      'assistant.security.readOnlyMode',
      // Model-facing: the appended confirmation prompt is often a question, so say plainly nothing ran.
      DEFAULT_READ_ONLY_MESSAGE,
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

    const updatedMessages = appendResponseMessages(messages, responseMessages);

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
    diagnostics?: ChatDiagnostics,
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
        stepsCount: diagnostics ? steps.length : null,
        success: diagnostics ? diagnostics.outcome === 'completed' : null,
        error: diagnostics?.error ?? null,
        metadata: diagnostics
          ? { toolPromptTokenEstimate: tokenEstimate, diagnostics }
          : { toolPromptTokenEstimate: tokenEstimate },
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
