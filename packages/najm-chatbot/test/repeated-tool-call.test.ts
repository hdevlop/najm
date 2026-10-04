import { describe, test, expect } from 'bun:test';
import { generateText, jsonSchema, stepCountIs, tool } from 'ai';
import { MockLanguageModelV1 } from '../src/testing/MockLanguageModel';
import { answerAfterRepeatedToolCall } from '../src/agent/ChatAgent';

const call = (toolName: string, input: unknown) => ({ toolName, input });

describe('answerAfterRepeatedToolCall', () => {
  test('leaves the first steps and changing calls alone', () => {
    expect(answerAfterRepeatedToolCall({ steps: [] })).toBeUndefined();
    expect(answerAfterRepeatedToolCall({ steps: [{ toolCalls: [call('count', {})] }] })).toBeUndefined();
    expect(answerAfterRepeatedToolCall({
      steps: [{ toolCalls: [call('get', { id: '1' })] }, { toolCalls: [call('get', { id: '2' })] }],
    })).toBeUndefined();
    expect(answerAfterRepeatedToolCall({
      steps: [{ toolCalls: [call('get', {})] }, { toolCalls: [call('count', {})] }],
    })).toBeUndefined();
  });

  test('does not treat two steps without tool calls as a repeat', () => {
    expect(answerAfterRepeatedToolCall({ steps: [{ toolCalls: [] }, { toolCalls: [] }] })).toBeUndefined();
  });

  test('answers without tools after the same calls twice, in any order', () => {
    expect(answerAfterRepeatedToolCall({
      steps: [{ toolCalls: [call('get', {})] }, { toolCalls: [call('get', {})] }],
    })).toEqual({ toolChoice: 'none' });
    expect(answerAfterRepeatedToolCall({
      steps: [
        { toolCalls: [call('a', { x: 1 }), call('b', {})] },
        { toolCalls: [call('b', {}), call('a', { x: 1 })] },
      ],
    })).toEqual({ toolChoice: 'none' });
  });

  test('ends a model that keeps retrying a failing call with an answer', async () => {
    const toolChoices: unknown[] = [];
    let executions = 0;
    const model = new MockLanguageModelV1({
      doGenerate: async (options) => {
        toolChoices.push(options.toolChoice?.type);
        if (options.toolChoice?.type === 'none') {
          return { text: 'I could not read that teacher.', finishReason: 'stop' };
        }
        return {
          toolCalls: [{ toolCallId: `call-${toolChoices.length}`, toolName: 'get_teacher', args: '{}' }],
          finishReason: 'tool-calls',
        };
      },
    });

    const result = await generateText({
      model,
      prompt: 'How many teachers?',
      tools: {
        get_teacher: tool({
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          execute: async () => {
            executions++;
            return 'Invalid arguments: id is required';
          },
        }),
      },
      stopWhen: stepCountIs(10),
      prepareStep: answerAfterRepeatedToolCall,
    });

    expect(executions).toBe(2);
    expect(toolChoices).toEqual(['auto', 'auto', 'none']);
    expect(result.steps).toHaveLength(3);
    expect(result.text).toBe('I could not read that teacher.');
  });
});
