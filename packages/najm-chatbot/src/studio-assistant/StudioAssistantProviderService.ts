import { plugin, Service } from 'najm-core';
import { streamText, tool as aiTool } from 'ai';
import { McpBuilderService, McpRegistryService } from 'najm-mcp';
import type { RegisteredTool } from 'najm-mcp';
import {
  STUDIO_ASSISTANT_PROVIDER,
  STUDIO_WRITE_TOOLS,
  type StudioAssistantProvider,
  type StudioAssistantRunInput,
} from 'najm-rag';
import { AiSettingsService } from '../ai-settings/AiSettingsService';
import { buildModel } from '../agent/LlmProviderFactory';
import { toolParametersSchema } from '../agent/McpToolAdapter';

interface StudioToolResult {
  text: string;
  isError: boolean;
}

/**
 * Per-view tool playbooks. These teach the LLM the *shape* of each tool
 * (required args, common patterns, gotchas) so it doesn't have to guess
 * from tool descriptions alone.
 */
const VIEW_PLAYBOOKS: Record<string, string> = {
  'routing-semantics': `
A "semantic" is one natural-language phrase that should route to one tool name. Schema fields:
  - toolName: string (e.g. "products_create", "orders_get")
  - phrase: string (the natural sentence a user might say)
  - lang: "en" | "fr" | "ar" | "darija"

Common tasks:
- "Create semantics for cart" / "add phrases for X":
    1. Call rag_studio_create_semantic ONCE per phrase. Each call needs { toolName, phrase, lang }.
    2. If the user asks for "5 phrases", generate 5 diverse phrases per language and call create_semantic 5×N times — OR use rag_studio_import_semantics with items: [{ toolName, phrases: [{ phrase, lang }, ...] }] for one round-trip.
    3. Prefer import_semantics when adding more than ~3 phrases — it is one tool call instead of many.
- "Update phrase X to Y": call rag_studio_list_semantics to find the id, then rag_studio_update_semantic with { id, phrase }.
- "Delete duplicates" / "delete these": collect ids from the visible context (or via list_semantics), then call rag_studio_delete_semantics_batch with { ids: [...] } in ONE call.
- "Test if X routes to Y": call rag_studio_preview_routing with { query: X } — does NOT mutate anything, safe to run.
- "Reindex" / "regenerate embeddings": call rag_studio_reindex_semantics — slow, only when user explicitly asks.

When the user names a tool group ("create semantics for cart"):
  - If the visible context already lists the real tool names, use those.
  - Otherwise call rag_studio_tool_list FIRST to discover the exact registered names. Do NOT assume names from the group label — the actual tool names may be longer (e.g. "<group>_add_item" rather than "<group>_add").
  - Do not invent tool names — only use the exact strings tool_list returned.
`,

  'routing-tests': `
A "routing test" is a query + expected tool names. Schema fields:
  - name: string (short label)
  - query: string (the user message to simulate)
  - expectedTools: string[] (tool names the router should pick)

Common tasks:
- "Add tests for X CRUD" / "add tests for the cart tools": YOU generate the tests yourself.
    Step 1: call rag_studio_tool_list to find the real tool names matching X. Use the names tool_list returned verbatim — do NOT guess shorter or stylised variants from the group label.
    Step 2: write one natural-language query per tool — vary phrasing, use realistic user wording, not the tool name verbatim.
    Step 3: call rag_studio_import_routing_tests ONCE with { items: [{ name, query, expectedTools: [toolName] }, ...] }.
    Do NOT ask the user to enumerate queries — that is your job.
- "Add a test that 'X' should route to Y": rag_studio_create_routing_test with { name, query: X, expectedTools: [Y] }.
- "Run all tests": rag_studio_run_all_routing_tests — no args. Slow.
- "Run this test" / "run the failing one": rag_studio_run_routing_test with { id } from context.
- "Import tests" from JSON: rag_studio_import_routing_tests with { items: [...] }.
- "Delete the failing ones": batch by ids → rag_studio_delete_routing_tests_batch.
- "Wipe all tests": ONLY when explicitly asked → rag_studio_delete_all_routing_tests. Confirm in your reply.

Worked example (illustrative — real tool names come from tool_list, do not copy these placeholders):
  User: "add tests for <group> CRUD".
  1. tool_list -> returns the registered names, e.g. <tool_a>, <tool_b>, <tool_c>. Use those exact strings.
  2. Build items, one per returned tool:
     [
       { name: "<tool_a> — basic", query: "<natural-language phrasing>", expectedTools: ["<tool_a>"] },
       { name: "<tool_b> — basic", query: "<natural-language phrasing>", expectedTools: ["<tool_b>"] },
       ...
     ]
  3. ONE call: rag_studio_import_routing_tests({ items }).
  4. Reply: "Created N <group> tests. Run them via 'run all tests' to confirm routing."
`,

  'routing-tools': `
This view lists MCP tools registered with the system. Read-only summary + reindex.
- "Show me the tools": rag_studio_tool_list.
- "Rebuild the tool index" / "reindex tools": rag_studio_reindex_tools — slow. Only when explicitly asked.
You CANNOT create/update/delete tools from here (those endpoints aren't exposed yet).
`,

  knowledge: `
Read-only over the knowledge base from this view.
- "Find docs about X": rag_studio_search_knowledge with { query: X, limit?: number }.
You cannot upload, delete, or reindex documents from here (those endpoints aren't exposed yet).
`,

  settings: `
Read-only diagnostics from this view.
- "Is the system healthy?" / "what's the status": rag_studio_status.
You cannot mutate settings from here yet.
`,
};

@Service()
export class StudioAssistantProviderService implements StudioAssistantProvider {
  constructor(
    private settingsService: AiSettingsService,
    private registry: McpRegistryService,
    private builder: McpBuilderService,
  ) {}

  async run(input: StudioAssistantRunInput): Promise<Response> {
    const settings = await this.settingsService.getInternal();
    if (!settings?.isEnabled) {
      return this.sse([{ type: 'error', message: 'AI assistant is disabled in settings.' }]);
    }
    if (!settings.model) {
      return this.sse([{ type: 'error', message: 'No AI model is configured.' }]);
    }

    const allowed = new Set(input.allowedTools);
    const tools = this.registry.tools.filter((tool) => allowed.has(tool.name));
    const aiTools = this.buildObservableTools(tools);

    const model = buildModel({
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey ?? null,
      baseUrl: settings.baseUrl ?? null,
    });

    const system = this.buildSystemPrompt(input);

    const result = streamText({
      model,
      system,
      messages: [{ role: 'user', content: input.message }],
      tools: Object.keys(aiTools).length ? aiTools : undefined,
      maxSteps: 8,
    });

    return this.toStudioSse(result, input.sessionId ?? crypto.randomUUID());
  }

  private buildObservableTools(tools: RegisteredTool[]): Record<string, any> {
    const aiSdkTools: Record<string, any> = {};
    const t = aiTool as any;

    for (const mcpTool of tools) {
      const schema = toolParametersSchema(mcpTool);

      aiSdkTools[mcpTool.name] = t({
        description: mcpTool.description ?? mcpTool.name,
        parameters: schema,
        execute: async (args: any): Promise<StudioToolResult> => {
          const result = await this.builder.invokeTool(mcpTool.name, args as Record<string, any>);
          const content = result.content?.[0];
          return {
            text: content?.text ?? JSON.stringify(result),
            isError: !!result.isError,
          };
        },
      });
    }

    return aiSdkTools;
  }

  private buildSystemPrompt(input: StudioAssistantRunInput): string {
    const playbook = VIEW_PLAYBOOKS[input.view] ?? '';
    return [
      'You are the Najm RAG Studio Assistant — an admin agent that edits routing data through tool calls.',
      '',
      '## Behaviour rules (read these first)',
      '- BE PROACTIVE. If the request has obvious defaults — "add tests for cart CRUD", "create semantics for X" — generate the rows yourself and call the create/import tool. DO NOT stall the user by asking them to enumerate names, queries, or expected tools that you can reasonably infer.',
      '- DISCOVER BEFORE GUESSING. When you need real tool names (e.g. user says "cart tools" and you do not know if they are named cart_add or cartsCreate), CALL rag_studio_tool_list FIRST. Only ask the user if discovery fails or the request is genuinely ambiguous (e.g. multiple incompatible interpretations).',
      '- Acceptable clarifying questions: real ambiguity (e.g. "which language?", "delete just the duplicates or all of them?"). Unacceptable: "what queries do you want?", "what tool names should they route to?" when you can infer them.',
      '- The user replying "yes" / "ok" / "go ahead" / "do it" means: execute the most recently proposed plan. Do not ask again.',
      '',
      '## Core rules',
      '- ONLY call tools listed under "Allowed tools" below. Never invent tool names or argument names.',
      '- Prefer a read tool (list/get/preview/tool_list) BEFORE any write tool, so you operate on real ids and real tool names.',
      '- For destructive tools (delete_*, reindex_*, run_all_*, delete_all_*): only call them when the user explicitly asks. Never use them to "clean up" speculatively.',
      '- When the user references "the selected ones", "these", "the top N", "this row" — resolve those against the "Visible UI context" JSON below. The ids are there.',
      '- For batch operations (e.g. delete_semantics_batch, import_semantics, import_routing_tests), collect everything first then call the batch tool ONCE. Do not loop create_X / delete_X when a batch tool exists.',
      '- After tool calls finish, write a short final message: what changed, how many rows, and any next step the user should verify.',
      '- If a tool call fails (ok=false), report the error verbatim and STOP — do not retry with guesses.',
      '',
      `## Active view: ${input.view}`,
      `## Allowed tools: ${input.allowedTools.join(', ') || 'none'}`,
      '',
      playbook ? `## Playbook for this view\n${playbook}` : '',
      '',
      input.context
        ? `## Visible UI context (what the user is looking at right now)\n\`\`\`json\n${JSON.stringify(input.context).slice(0, 8000)}\n\`\`\``
        : '',
    ].filter(Boolean).join('\n');
  }

  private async toStudioSse(result: any, sessionId: string): Promise<Response> {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              send({ type: 'text', delta: part.textDelta });
            }
            if (part.type === 'tool-call') {
              send({
                type: 'tool_call',
                id: part.toolCallId,
                name: part.toolName,
                args: part.args,
                requiresConfirmation: STUDIO_WRITE_TOOLS.has(part.toolName),
              });
            }
            if (part.type === 'tool-result') {
              const toolResult = part.result as StudioToolResult | undefined;
              const isError = toolResult && typeof toolResult === 'object' && 'isError' in toolResult
                ? toolResult.isError
                : false;
              send({
                type: 'tool_result',
                id: part.toolCallId,
                name: part.toolName,
                ok: !isError,
                result: toolResult?.text ?? part.result,
              });
            }
          }
          send({ type: 'done', sessionId });
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'Assistant failed.' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  private sse(events: unknown[]): Response {
    return new Response(
      events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  }
}

export const studioAssistant = () =>
  plugin('chatbot-studio-assistant')
    .version('1.0.0')
    .requires('chatbot', 'rag', 'mcp')
    .services(StudioAssistantProviderService)
    .alias(STUDIO_ASSISTANT_PROVIDER, StudioAssistantProviderService)
    .build();