import type { StudioAssistantEvent } from '../types';

export async function readStudioAssistantStream(
  response: Response,
  onEvent: (event: StudioAssistantEvent) => void,
) {
  if (!response.body) throw new Error('Assistant response did not include a stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const line = chunk.split('\n').find((item) => item.startsWith('data: '));
      if (!line) continue;
      onEvent(JSON.parse(line.slice('data: '.length)));
    }
  }
}