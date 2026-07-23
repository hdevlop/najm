export enum McpErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_ARGS = 'INVALID_ARGS',
  RATE_LIMITED = 'RATE_LIMITED',
  UNAVAILABLE = 'UNAVAILABLE',
  INTERNAL = 'INTERNAL',
}

export class McpException extends Error {
  constructor(
    message: string,
    public readonly code: McpErrorCode = McpErrorCode.INTERNAL,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'McpException';
  }
}
