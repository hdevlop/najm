// ============================================================================
// ResponseFormatter - Handles response formatting with optional wrapping
// ============================================================================

import { Context } from 'hono';
import { 
  getResponseMessage, 
  resolveMessage,
  shouldSkipWrapping,
  type ResponseMessageOptions,
  type ResponseConfig,
  type WrappedResponse 
} from './response';

export class ResponseFormatter {
  private translator?: (key: string) => string;
  private config: ResponseConfig;
  private messageOptions?: ResponseMessageOptions;
  private skipWrapping: boolean;

  constructor(
    private context: Context,
    options?: {
      translator?: (key: string) => string;
      config?: ResponseConfig;
      messageOptions?: ResponseMessageOptions;
      skipWrapping?: boolean;
    }
  ) {
    this.translator = options?.translator;
    this.config = options?.config ?? {};
    this.messageOptions = options?.messageOptions;
    this.skipWrapping = options?.skipWrapping ?? false;
  }

  formatResponse(response: any): Response {
    // Handle null/undefined
    if (response === null || response === undefined) {
      return this.context.body(null, 204);
    }

    // Handle redirects
    if (this.isRedirectResponse(response)) {
      return this.context.redirect(response.redirect, response.status);
    }

    // Pass through Response objects
    if (response instanceof Response) {
      return response;
    }

    // Handle streams
    if (response instanceof ReadableStream) {
      return this.context.body(response);
    }

    // Handle strings (HTML or text)
    if (typeof response === 'string') {
      return this.isHtmlContent(response)
        ? this.context.html(response)
        : this.context.text(response);
    }

    // Handle objects
    if (typeof response === 'object') {
      return this.formatObjectResponse(response);
    }

    // Default: wrap primitives
    return this.wrapResponse(response);
  }

  /**
   * Format object responses with smart wrapping
   */
  private formatObjectResponse(response: any): Response {
    // Already wrapped (has status string) - just add message if needed
    if (this.isAlreadyWrapped(response)) {
      return this.finalizeResponse(response);
    }

    // Has numeric status code - use it
    if ('status' in response && typeof response.status === 'number') {
      return this.context.json(response, response.status as any);
    }

    // Has statusCode property (from helper functions)
    if ('statusCode' in response && typeof response.statusCode === 'number') {
      const { statusCode, ...rest } = response;
      return this.context.json(rest, statusCode as any);
    }

    // Check if we should auto-wrap
    if (this.shouldWrap()) {
      return this.wrapResponse(response);
    }

    // Default: return as-is
    return this.context.json(response);
  }

  /**
   * Check if response is already in wrapped format
   */
  private isAlreadyWrapped(response: any): boolean {
    return (
      typeof response === 'object' &&
      'status' in response &&
      typeof response.status === 'string' &&
      'data' in response
    );
  }

  /**
   * Determine if we should wrap the response
   */
  private shouldWrap(): boolean {
    // Never wrap if @RawResponse() or @RawController()
    if (this.skipWrapping) {
      return false;
    }

    // Wrap if @ResMsg decorator is present
    if (this.messageOptions?.message) {
      return true;
    }

    // Wrap if auto-wrap is enabled in config
    if (this.config.autoWrap) {
      return true;
    }

    return false;
  }

  /**
   * Wrap data in standard response format
   */
  private wrapResponse(data: any): Response {
    const message = this.resolveMessageText();
    const status = this.messageOptions?.status ?? 200;
    
    const wrapped: WrappedResponse = {
      data,
      status: this.messageOptions?.statusText ?? this.config.defaultStatus ?? 'success',
    };

    if (message) {
      wrapped.message = message;
    }

    if (this.messageOptions?.timestamp || this.config.includeTimestamp) {
      wrapped.timestamp = new Date().toISOString();
    }

    return this.context.json(wrapped, status as any);
  }

  /**
   * Finalize an already wrapped response (add message if missing)
   */
  private finalizeResponse(response: WrappedResponse): Response {
    const message = this.resolveMessageText();
    
    if (message && !response.message) {
      response.message = message;
    }

    if ((this.messageOptions?.timestamp || this.config.includeTimestamp) && !response.timestamp) {
      response.timestamp = new Date().toISOString();
    }

    const status = this.messageOptions?.status ?? 200;
    return this.context.json(response, status as any);
  }

  /**
   * Resolve the message text (translate if needed)
   */
  private resolveMessageText(): string | undefined {
    if (!this.messageOptions?.message) {
      return undefined;
    }

    return resolveMessage(
      this.messageOptions.message,
      this.messageOptions,
      this.translator
    );
  }

  private isRedirectResponse(response: any): boolean {
    return typeof response === 'object' && 'redirect' in response;
  }

  private isHtmlContent(content: string): boolean {
    return content.trim().startsWith('<') && content.trim().endsWith('>');
  }
}
