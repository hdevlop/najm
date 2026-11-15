/** Schema state as `/status` reports it (RagSchemaStatus on the server). */
export interface StudioSchemaStatus {
  ensureSchema: boolean;
  checked: boolean;
  missing: string[];
  error?: string;
  message?: string;
}

/** The text the API returned (the client already parsed `message` / `error`), or null. */
export function serverMessage(err: unknown): string | null {
  if (err instanceof Error) return err.message.trim() || null;
  if (typeof err === 'string') return err.trim() || null;
  return null;
}

/**
 * "Failed to load tools: <what the server said>". A fixed label alone hid the
 * cause, e.g. a missing database column, behind "Failed to load tools."
 */
export function withServerMessage(label: string, err: unknown): string {
  const base = label.trim().replace(/[.:]+$/, '');
  const detail = serverMessage(err);
  return detail ? `${base}: ${detail}` : `${base}.`;
}

/**
 * A missing table or column explains every failed read at once, and says what
 * to do, so it wins over the error of whichever request failed first.
 */
export function describeLoadError(label: string, err: unknown, schema?: StudioSchemaStatus | null): string {
  if (schema?.missing?.length && schema.message) return schema.message;
  return withServerMessage(label, err);
}
