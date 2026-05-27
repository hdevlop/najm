import { describe, expect, test } from 'bun:test';
import { McpError, McpImage, McpJson, McpList, McpResult, McpText } from '../src';

describe('najm-mcp result helpers', () => {
  test('builds text, image, json, and list content payloads', () => {
    const text = McpText('hello');
    const image = McpImage('base64-data', 'image/png');
    const json = McpJson({ ok: true });
    const list = McpList([text, image, json]);

    expect(text).toEqual({ content: [{ type: 'text', text: 'hello' }] });
    expect(image).toEqual({ content: [{ type: 'image', data: 'base64-data', mimeType: 'image/png' }] });
    expect(JSON.parse(json.content[0].type === 'text' ? json.content[0].text : '{}')).toEqual({ ok: true });
    expect(list.content).toHaveLength(3);
  });

  test('builds success and error helpers', () => {
    const success = McpResult({ ok: true, count: 2 });
    const failure = McpError('Validation failed', { field: 'title' });

    expect(JSON.parse(success.content[0].type === 'text' ? success.content[0].text : '{}')).toEqual({
      ok: true,
      count: 2,
    });
    expect(failure.isError).toBe(true);
    expect(JSON.parse(failure.content[0].type === 'text' ? failure.content[0].text : '{}')).toEqual({
      error: 'Validation failed',
      field: 'title',
    });
  });
});
