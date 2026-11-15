import { describe, test, expect, mock } from 'bun:test';
import { ChatAgent } from '../src/agent/ChatAgent';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';

function makeAgent() {
  const sessions = new Map<string, any[]>();
  const store = {
    load: async (key: string) => sessions.get(key) ?? null,
    loadSession: async (key: string) => (sessions.has(key) ? { messages: sessions.get(key)!, userId: null } : null),
    save: async (key: string, messages: any[]) => { sessions.set(key, JSON.parse(JSON.stringify(messages))); },
    clear: async (key: string) => { sessions.delete(key); },
  } as any;
  const agent = new ChatAgent(
    { getInternal: async () => ({ isEnabled: true, provider: 'openai', apiKey: 'sk', model: 'gpt-test', systemPrompt: 'x' }) } as any,
    store,
    store,
    { tools: 'none', chatLogging: { enabled: false }, maxSteps: 10, conversationStore: 'db' } as any,
    { insert: mock(() => Promise.resolve()) } as any,
  );
  (agent as any).container = { get: () => { throw new Error('none'); } };
  const prompts: any[] = [];
  let turn = 0;
  (agent as any).buildModel = () => new MockLanguageModelV1({
    doGenerate: async (options: any) => {
      prompts.push(options.prompt);
      turn += 1;
      return { text: `reply ${turn}`, finishReason: 'stop', usage: {} };
    },
  });
  return { agent, sessions, prompts };
}

const roles = (messages: any[]) => messages.map((message) => message.role);

describe('C5: merging stored history with the request', () => {
  test('two identical messages without ids both reach the model', async () => {
    const { agent, prompts, sessions } = makeAgent();
    await agent.runOnce({ sessionKey: 's', messages: [{ role: 'user', content: 'yes' } as any] });
    await agent.runOnce({ sessionKey: 's', messages: [{ role: 'user', content: 'yes' } as any] });

    expect(roles(prompts[1])).toEqual(['system', 'user', 'assistant', 'user']);
    expect(roles(sessions.get('s')!)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  test('a client that resends its whole history leaves one stored copy of each message', async () => {
    const { agent, sessions } = makeAgent();
    // Client-side ids never match the ids the server gave stored answers.
    const client: any[] = [];
    for (let turn = 1; turn <= 3; turn++) {
      client.push({ id: `u${turn}`, role: 'user', parts: [{ type: 'text', text: `question ${turn}` }] });
      const answer = await agent.runOnce({ sessionKey: 'full', messages: [...client] });
      client.push({ id: `client-a${turn}`, role: 'assistant', parts: [{ type: 'text', text: answer }] });
    }

    const stored = sessions.get('full')!;
    expect(roles(stored)).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
    expect(stored.filter((message) => message.role === 'user').map((message) => message.parts[0].text))
      .toEqual(['question 1', 'question 2', 'question 3']);
  });

  test('a message already stored is not appended again', async () => {
    const { agent, sessions } = makeAgent();
    const first = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] } as any;
    await agent.runOnce({ sessionKey: 'retry', messages: [first] });
    await agent.runOnce({ sessionKey: 'retry', messages: [first, { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'again' }] } as any] });

    expect(sessions.get('retry')!.filter((message) => message.id === 'u1')).toHaveLength(1);
  });
});
