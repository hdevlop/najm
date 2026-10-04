import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Server, Controller, Get, Post, Service } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { mcp, McpTool } from 'najm-mcp';
import { chatbot, type ChatbotConfig } from '../src/ChatbotPlugin';
import { ChatAgent } from '../src/agent/ChatAgent';
import { summarizeUsage, type ChatDiagnostics } from '../src/agent/ChatDiagnostics';
import { AiSettingsService } from '../src/ai-settings/AiSettingsService';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { createCredentialSetupTables } from './auth-test-schema';
import { aiSettingsTable } from '../src/schema/sqlite';
import { usersTable, rolesTable, tokensTable, permissionsTable, rolePermissionsTable } from 'najm-auth/sqlite';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';
import { simulateReadableStream } from 'ai';
import { createGuard } from 'najm-guard';
import { detectMoroccanReplyLanguage } from '../src/agent/replyPolicy';

const JWT_SECRET = 'test-access-secret-that-is-at-least-32-chars!';
const ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const schema = {
  aiSettings: aiSettingsTable,
  users: usersTable,
  roles: rolesTable,
  tokens: tokensTable,
  permissions: permissionsTable,
  rolePermissions: rolePermissionsTable,
};

function createSchema(sqlite: Database) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ai_settings (id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'ollama', api_key_encrypted TEXT, base_url TEXT, model TEXT NOT NULL DEFAULT 'llama3.1', system_prompt TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, use_memory INTEGER NOT NULL DEFAULT 1, max_stored_messages INTEGER, max_prompt_messages INTEGER, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS chatbot_interaction_logs (id TEXT PRIMARY KEY, session_key TEXT, user_query TEXT NOT NULL, query_lang TEXT, routing_enabled INTEGER NOT NULL DEFAULT 0, routing_status TEXT NOT NULL, routed_tools TEXT, actual_tool_names TEXT, model_tool_calls TEXT, model_answer TEXT, steps_count TEXT, success INTEGER, error TEXT, metadata TEXT, created_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER DEFAULT 0, password TEXT NOT NULL, image TEXT DEFAULT 'noavatar.png', status TEXT DEFAULT 'active', role_id TEXT REFERENCES roles(id), last_login TEXT, failed_login_attempts INTEGER DEFAULT 0, lockout_until TEXT, phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL, token_family TEXT NOT NULL UNIQUE, previous_hash TEXT, previous_valid_until TEXT, previous_used_at TEXT, type TEXT DEFAULT 'refresh', status TEXT DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, resource TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT, updated_at TEXT)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS role_permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, created_at TEXT, updated_at TEXT)`);
  createCredentialSetupTables(sqlite);
}

@Service()
class DenyReads { canActivate() { return false; } }
const Denied = createGuard(DenyReads);

@Controller('/grades')
class GradeTools {
  @Get('/count')
  @McpTool({ description: 'Count grades', readOnly: true })
  count() {
    return { count: 3 };
  }

  @Get('/denied-count')
  @Denied()
  @McpTool({ description: 'A forbidden count', readOnly: true })
  deniedCount() {
    throw new Error('The guard must prevent this method from running');
  }

  @Post('/')
  @McpTool({ description: 'Create a grade', destructive: true, confirm: { level: 'danger', message: 'grades.confirm' } })
  create() {
    return { created: true };
  }
}

let server: Server | undefined;
let sqlite: Database | undefined;
let port = 3680;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function setup(model: MockLanguageModelV1, config: ChatbotConfig = {}) {
  const p = ++port;
  sqlite = new Database(':memory:');
  createSchema(sqlite);

  server = new Server({ isolated: true })
    .use(database({ default: drizzle(sqlite, { schema }) }))
    .use(auth({
      dialect: 'sqlite',
      jwt: { accessSecret: JWT_SECRET, refreshSecret: JWT_SECRET },
      encryptionKey: ENCRYPTION_KEY,
    }))
    .use(mcp({ name: 'diagnostics-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .use(chatbot({ dialect: 'sqlite', ...config }))
    .load(GradeTools, DenyReads);
  await server.listen(p);

  const container = (server as any).container;
  await (container.get(AiSettingsService) as AiSettingsService).upsert({
    provider: 'openrouter',
    apiKey: 'sk-fake-unused',
    model: 'openai/gpt-oss-120b',
    isEnabled: true,
  } as any);
  (container.get(ChatAgent) as any).buildModel = () => model;

  await fetch(`http://localhost:${p}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'Password123!', name: 'U' }),
  });
  const login = await fetch(`http://localhost:${p}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'Password123!' }),
  });
  return { p, token: (await login.json()).data.accessToken as string, container };
}

async function chat(p: number, token: string, text = 'how many grades?') {
  const res = await fetch(`http://localhost:${p}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
  });
  // A provider error mid-answer can reset the connection instead of sending an error event.
  const body = await res.text().catch((error: unknown) => `[reset] ${String(error)}`);
  return { status: res.status, body };
}

function streamOf(chunks: any[]) {
  return {
    stream: simulateReadableStream({ chunks }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  };
}

/** Step 1 calls `toolName`, step 2 answers. */
function toolThenAnswer(toolName: string) {
  let call = 0;
  return new MockLanguageModelV1({
    doStream: async () => {
      call++;
      if (call === 1) {
        return streamOf([
          { type: 'tool-call', toolCallType: 'function', toolCallId: 'call-1', toolName, args: '{}' },
          { type: 'finish', finishReason: 'tool-calls', logprobs: undefined, usage: { promptTokens: 400, completionTokens: 20 } },
        ]);
      }
      return streamOf([
        { type: 'text-delta', textDelta: 'There are 3 grades.' },
        { type: 'finish', finishReason: 'stop', logprobs: undefined, usage: { promptTokens: 500, completionTokens: 10 } },
      ]);
    },
  });
}

function collect() {
  const received: ChatDiagnostics[] = [];
  return { received, onDiagnostics: (d: ChatDiagnostics) => { received.push(d); } };
}

/** The sink runs inside onFinish, which can settle just after the body ends. */
async function waitFor(check: () => boolean, ms = 2_000) {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error('timed out waiting for diagnostics');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('chat diagnostics', () => {
  test('records spans, steps, tools, usage and one completed outcome', async () => {
    const sink = collect();
    const { p, token } = await setup(toolThenAnswer('count'), { chatLogging: { enabled: false, onDiagnostics: sink.onDiagnostics } });

    const { status, body } = await chat(p, token);
    expect(status).toBe(200);
    expect(body).toContain('There are 3 grades.');
    await waitFor(() => sink.received.length > 0);

    expect(sink.received).toHaveLength(1);
    const d = sink.received[0]!;
    expect(d).toMatchObject({
      version: 1,
      channel: 'web',
      provider: 'openrouter',
      model: 'openai/gpt-oss-120b',
      outcome: 'completed',
      error: null,
      messages: { stored: 0, prompt: 1 },
    });
    expect(typeof d.correlationId).toBe('string');
    for (const key of ['settingsMs', 'historyMs', 'prepareMs'] as const) {
      expect(d.spans[key]).toBeGreaterThanOrEqual(0);
    }

    expect(d.steps.map((step) => [step.finishReason, step.toolCalls])).toEqual([
      ['tool-calls', ['count']],
      ['stop', []],
    ]);
    expect(d.steps[0]).toMatchObject({ inputTokens: 400, outputTokens: 20 });
    expect(d.tools).toHaveLength(1);
    expect(d.tools[0]).toMatchObject({ name: 'count', toolCallId: 'call-1', outcome: 'executed' });
    expect(d.tools[0]!.resultChars).toBeGreaterThan(0);

    // First text arrives after the tool step and before generation ends.
    expect(d.marks.firstTextMs).not.toBeNull();
    expect(d.marks.firstTextMs!).toBeGreaterThanOrEqual(d.steps[0]!.endMs);
    expect(d.marks.finishMs!).toBeGreaterThanOrEqual(d.marks.firstTextMs!);

    expect(d.usage).toMatchObject({ source: 'total', inputTokens: 900, outputTokens: 30, totalTokens: 930 });
    expect(d.cost).toMatchObject({ promptTokens: 900, completionTokens: 30, pricingFound: true });
  });

  test('records a blocked write as a blocked tool span', async () => {
    const sink = collect();
    const { p, token } = await setup(toolThenAnswer('create'), { chatLogging: { enabled: false, onDiagnostics: sink.onDiagnostics } });

    await chat(p, token, 'add a grade');
    await waitFor(() => sink.received.length > 0);

    expect(sink.received[0]!.tools.map((tool) => [tool.name, tool.outcome])).toEqual([['create', 'blocked']]);
  });

  test('records a provider stream error as one error outcome', async () => {
    const sink = collect();
    const failing = new MockLanguageModelV1({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'partial' });
            // Mid-answer, like a provider connection that drops after some text.
            setTimeout(() => controller.error(new Error('provider reset')), 20);
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const { p, token } = await setup(failing, { chatLogging: { enabled: false, onDiagnostics: sink.onDiagnostics } });

    await chat(p, token);
    await waitFor(() => sink.received.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sink.received).toHaveLength(1);
    expect(sink.received[0]).toMatchObject({ outcome: 'error' });
    expect(sink.received[0]!.error).toContain('provider reset');
    expect(sink.received[0]!.marks.firstTextMs).not.toBeNull();
  });

  test('records a stall timeout as a terminal failure, not a completion', async () => {
    const sink = collect();
    const stalled = new MockLanguageModelV1({
      doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'partial' });
            abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const { p, token } = await setup(stalled, {
      streamTimeout: { chunkMs: 200 },
      chatLogging: { enabled: false, onDiagnostics: sink.onDiagnostics },
    });

    await chat(p, token);
    await waitFor(() => sink.received.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sink.received).toHaveLength(1);
    expect(['error', 'aborted']).toContain(sink.received[0]!.outcome);
  });

  test('records a client that disconnects mid-answer as aborted', async () => {
    const sink = collect();
    const hanging = new MockLanguageModelV1({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'partial' });
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    const { p, token } = await setup(hanging, { chatLogging: { enabled: false, onDiagnostics: sink.onDiagnostics } });

    const client = new AbortController();
    const res = await fetch(`http://localhost:${p}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      signal: client.signal,
    });
    const reader = res.body!.getReader();
    let seen = '';
    while (!seen.includes('partial')) seen += new TextDecoder().decode((await reader.read()).value);
    client.abort();
    await waitFor(() => sink.received.length > 0);

    expect(sink.received).toHaveLength(1);
    expect(sink.received[0]).toMatchObject({ outcome: 'aborted' });
    expect(sink.received[0]!.marks.firstTextMs).not.toBeNull();
  });

  test('records a failure before the model is called as setup_error', async () => {
    const sink = collect();
    const { p, token, container } = await setup(new MockLanguageModelV1(), {
      chatLogging: { enabled: false, onDiagnostics: sink.onDiagnostics },
    });
    (container.get(ChatAgent) as any).buildModel = () => { throw new Error('bad provider config'); };

    const { status } = await chat(p, token);
    expect(status).toBeGreaterThanOrEqual(500);
    await waitFor(() => sink.received.length > 0);

    expect(sink.received[0]).toMatchObject({ outcome: 'setup_error', steps: [], marks: { finishMs: null } });
    expect(sink.received[0]!.error).toContain('bad provider config');
  });

  test('writes the outcome and diagnostics to the interaction log', async () => {
    const { p, token } = await setup(toolThenAnswer('count'), { chatLogging: { enabled: true } });

    await chat(p, token);
    await waitFor(() => (sqlite!.query('SELECT COUNT(*) AS n FROM chatbot_interaction_logs').get() as any).n > 0);

    const row = sqlite!.query('SELECT success, steps_count, error, metadata FROM chatbot_interaction_logs').get() as any;
    expect(row.success).toBe(1);
    expect(row.steps_count).toBe('2');
    expect(row.error).toBeNull();
    const metadata = JSON.parse(row.metadata);
    expect(metadata.diagnostics.outcome).toBe('completed');
    expect(metadata.diagnostics.tools[0].name).toBe('count');
    expect(typeof metadata.toolPromptTokenEstimate).toBe('number');
  });

  test('a failing sink does not break the answer', async () => {
    const { p, token } = await setup(toolThenAnswer('count'), {
      chatLogging: { enabled: false, onDiagnostics: () => { throw new Error('sink down'); } },
    });

    const { status, body } = await chat(p, token);
    expect(status).toBe(200);
    expect(body).toContain('There are 3 grades.');
  });
});

describe('summarizeUsage', () => {
  test('reads v6 detail fields and keeps unreported counts as null', () => {
    expect(summarizeUsage({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      inputTokenDetails: { cacheReadTokens: 60 },
      outputTokenDetails: { reasoningTokens: 25 },
    })).toEqual({ source: 'total', inputTokens: 100, outputTokens: 40, totalTokens: 140, cachedInputTokens: 60, reasoningTokens: 25 });

    expect(summarizeUsage({ inputTokens: 7 })).toEqual({
      source: 'total', inputTokens: 7, outputTokens: null, totalTokens: 7, cachedInputTokens: null, reasoningTokens: null,
    });
    expect(summarizeUsage(undefined)).toBeNull();
    expect(summarizeUsage({})).toBeNull();
  });
});

describe('reply templates through real MCP guards and HTTP streaming', () => {
  test('renders an authorized read without any provider request', async () => {
    const d = collect();
    let providerCalls = 0;
    const model = new MockLanguageModelV1({ doStream: async () => { providerCalls++; throw new Error('Unexpected provider call'); } });
    const { p, token, container } = await setup(model, {
      tools: 'all', reply: { detectLanguage: detectMoroccanReplyLanguage, template: () => ({
        calls: [{ name: 'count', input: {} }], render: ([value]: any[]) => `كاينين ${value.count} نقط.`,
      }) }, chatLogging: { enabled: false, onDiagnostics: d.onDiagnostics },
    });
    // Resolve the exact generated name, rather than assume controller prefixes.
    const registry = container.get((await import('najm-mcp')).McpRegistryService);
    const countTool = registry.tools.find((tool: any) => tool.methodKey === 'count');
    (container.get(ChatAgent) as any).config.reply.template = () => ({
      calls: [{ name: countTool.name, input: {} }], render: ([value]: any[]) => `كاينين ${value.count} نقط.`,
    });
    const reply = await chat(p, token, 'شحال من نقطة؟');
    expect(reply.status).toBe(200);
    expect(reply.body).toContain('كاينين 3 نقط');
    expect(reply.body).toContain('tool-output-available');
    expect(providerCalls).toBe(0);
    expect(d.received[0].tools[0].outcome).toBe('executed');
    expect(d.received[0].cost?.totalCost).toBe(0);
  });

  test('refuses an MCP read denied by its route guard', async () => {
    const d = collect();
    const { p, token, container } = await setup(toolThenAnswer('unused'), {
      tools: 'all', reply: { detectLanguage: detectMoroccanReplyLanguage },
      chatLogging: { enabled: false, onDiagnostics: d.onDiagnostics },
    });
    const registry = container.get((await import('najm-mcp')).McpRegistryService);
    const denied = registry.tools.find((tool: any) => tool.methodKey === 'deniedCount');
    (container.get(ChatAgent) as any).config.reply.template = () => ({
      calls: [{ name: denied.name, input: {} }], render: () => 'Invented fact',
    });
    const reply = await chat(p, token, 'كم عدد النقط؟');
    expect(reply.body).toContain('لا يمكنني الوصول');
    expect(reply.body).not.toContain('Invented fact');
    expect(d.received[0].tools[0].outcome).toBe('error');
    expect(d.received[0].reply?.error).toBe(true);
  });
});
