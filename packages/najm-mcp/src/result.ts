export type McpContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; text?: string; mimeType?: string } };

export type McpContent = { content: McpContentBlock[] };

function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    const json = JSON.stringify(value, null, 2);
    return typeof json === 'string' ? json : String(value);
  } catch {
    return String(value);
  }
}

export const McpText = (text: string): McpContent => ({
  content: [{ type: 'text', text }],
});

export const McpJson = (value: unknown): McpContent => {
  return {
    content: [{ type: 'text', text: stringify(value) }],
  };
};

export const McpResult = (data: Record<string, unknown>): McpContent => ({
  content: [{ type: 'text', text: stringify(data) }],
});

export const McpError = (
  message: string,
  details?: Record<string, unknown>,
): McpContent & { isError: true } => ({
  content: [{ type: 'text', text: details ? stringify({ error: message, ...details }) : message }],
  isError: true,
});

export const McpImage = (base64: string, mimeType: string): McpContent => ({
  content: [{ type: 'image', data: base64, mimeType }],
});

export const McpList = (items: McpContent[]): McpContent => ({
  content: items.flatMap((item) => item.content),
});
