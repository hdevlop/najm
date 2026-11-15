import { describe, test, expect } from 'bun:test';
import { describeLoadError, withServerMessage } from '../../src/studio-ui/lib/errorMessage';

describe('studio screens show what the API returned', () => {
  test('the label carries the server message instead of hiding it', () => {
    const err = new Error('Failed query: select "source_file" from "chatbot_tool_semantics"');
    expect(withServerMessage('Failed to load tools.', err))
      .toBe('Failed to load tools: Failed query: select "source_file" from "chatbot_tool_semantics"');
  });

  test('without a message the label stands alone', () => {
    expect(withServerMessage('Failed to load tools.', new Error(''))).toBe('Failed to load tools.');
    expect(withServerMessage('Failed to load tools', undefined)).toBe('Failed to load tools.');
  });

  test('a missing-column report wins over whichever request failed first', () => {
    const schema = {
      ensureSchema: false, checked: true, missing: ['chatbot_tool_semantics.source_file'],
      message: 'database is missing chatbot_tool_semantics.source_file: run your migrations (ensureSchema is off).',
    };
    expect(describeLoadError('Failed to load dashboard data', new Error('Internal Server Error'), schema))
      .toBe(schema.message);
    expect(describeLoadError('Failed to load dashboard data', new Error('Internal Server Error'), null))
      .toBe('Failed to load dashboard data: Internal Server Error');
  });
});
