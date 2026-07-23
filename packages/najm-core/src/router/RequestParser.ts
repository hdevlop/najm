import { Context } from 'hono';
import type { HRequest } from '../params/types';
import { Err } from '../errors';

const CONTENT_TYPES = {
   JSON: 'application/json',
   FORM_DATA: 'multipart/form-data',
   FORM_URLENCODED: 'application/x-www-form-urlencoded',
   TEXT: 'text/plain',
} as const;

const IP_HEADERS = [
   'x-forwarded-for',
   'x-real-ip',
   'cf-connecting-ip',
   'x-client-ip',
   'x-forwarded',
   'forwarded-for',
   'forwarded',
] as const;

const NUMBER_REGEX = /^-?\d+\.?\d*([eE][+-]?\d+)?$/;
const LEADING_ZERO_REGEX = /^0\d+/;

/**
 * Lazy request parser - only parses data when accessed
 */
export class RequestParser {
   // Cached parsed values
   private _body: any;
   private _bodyParsed = false;
   private _params: Record<string, string> | null = null;
   private _query: Record<string, string> | null = null;
   private _headers: Record<string, string> | null = null;
   private _cookies: Record<string, string> | null = null;
   private _files: Record<string, File | File[]> | null = null;
   private _ip: string | null = null;

   constructor(private readonly context: Context) {}

   /**
    * Creates HRequest with lazy getters - no eager parsing
    */
   public createRequest(): HRequest {
      const req = this.context.req;
      const self = this;

      return {
         // Immediate access (no parsing needed)
         queries: req.queries.bind(req),
         path: req.path,
         url: req.url,
         method: req.method,
         raw: req.raw,
         routePath: req.routePath,
         matchedRoutes: req.matchedRoutes,
         routeIndex: req.routeIndex,
         header: req.header.bind(req),

         // Lazy parsed values via getters
         get params() { return self.getParams(); },
         get query() { return self.getQuery(); },
         get body() { return self.getBody(); },
         get headers() { return self.getHeaders(); },
         get cookies() { return self.getCookies(); },
         get files() { return self.getFiles(); },
         get ip() { return self.getIP(); },

         // Pass-through methods (already lazy)
         json: req.json.bind(req),
         text: req.text.bind(req),
         arrayBuffer: req.arrayBuffer.bind(req),
         blob: req.blob.bind(req),
         formData: req.formData.bind(req),
         valid: req.valid.bind(req),
      };
   }

   /**
    * Async initialization for body/files (call only if needed)
    */
   public async parseAsync(): Promise<void> {
      await Promise.all([
         this.parseBody(),
         this.parseFiles(),
      ]);
   }

   // ============================================
   // Lazy Getters with Caching
   // ============================================

   private getBody(): any {
      if (!this._bodyParsed) {
         console.warn('Body accessed before async parsing - use @Body() decorator or await parseAsync()');
      }
      return this._body;
   }

   private getParams(): Record<string, string> {
      if (!this._params) {
         this._params = this.context.req.param();
      }
      return this._params;
   }

   private getQuery(): Record<string, string> {
      if (!this._query) {
         this._query = this.context.req.query();
      }
      return this._query;
   }

   private getHeaders(): Record<string, string> {
      if (!this._headers) {
         this._headers = this.extractHeaders();
      }
      return this._headers;
   }

   private getCookies(): Record<string, string> {
      if (!this._cookies) {
         this._cookies = this.parseCookies();
      }
      return this._cookies;
   }

   private getFiles(): Record<string, File | File[]> {
      if (!this._files) {
         console.warn('Files accessed before async parsing - use @File() decorator or await parseAsync()');
         this._files = {};
      }
      return this._files;
   }

   private getIP(): string {
      if (!this._ip) {
         this._ip = this.extractClientIP();
      }
      return this._ip;
   }

   // ============================================
   // Async Parsing Methods
   // ============================================

   public async parseBody(): Promise<any> {
      if (this._bodyParsed) return this._body;

      const contentType = this.getContentType();
      if (!contentType) {
         this._bodyParsed = true;
         return undefined;
      }

      try {
         this._body = await this.parseBodyByContentType(contentType);
      } catch {
         // Fallback or rethrow depending on needs. 
         // Assuming HttpError is available or just throw standard error
         Err('Invalid request body');
      }

      this._bodyParsed = true;
      return this._body;
   }

   public async parseFiles(): Promise<Record<string, File | File[]>> {
      if (this._files) return this._files;

      if (!this.isMultipartFormData()) {
         this._files = {};
         return this._files;
      }

      try {
         const formData = await this.context.req.formData();
         this._files = this.extractFilesFromFormData(formData);
      } catch {
         this._files = {};
      }

      return this._files;
   }

   // ============================================
   // Headers
   // ============================================

   private extractHeaders(): Record<string, string> {
      const headers: Record<string, string> = {};
      this.context.req.raw.headers.forEach((value, key) => {
         headers[key] = value;
      });
      return headers;
   }

   // ============================================
   // Cookies
   // ============================================

   private parseCookies(): Record<string, string> {
      const cookieHeader = this.context.req.header('cookie');
      if (!cookieHeader) return {};

      const cookies: Record<string, string> = {};
      for (const cookie of cookieHeader.split(';')) {
         const [name, ...rest] = cookie.trim().split('=');
         if (name && rest.length > 0) {
            cookies[name] = decodeURIComponent(rest.join('='));
         }
      }
      return cookies;
   }

   // ============================================
   // Client IP
   // ============================================

   private extractClientIP(): string {
      const headers = this.context.req.raw.headers;

      for (const header of IP_HEADERS) {
         const value = headers.get(header);
         if (value) {
            return value.split(',')[0].trim();
         }
      }

      return 'unknown';
   }

   // ============================================
   // Body Parsing Helpers
   // ============================================

   private getContentType(): string | undefined {
      return this.context.req.header('content-type')?.toLowerCase();
   }

   private isMultipartFormData(): boolean {
      return this.getContentType()?.includes(CONTENT_TYPES.FORM_DATA) ?? false;
   }

   private async parseBodyByContentType(contentType: string): Promise<any> {
      if (contentType.includes(CONTENT_TYPES.JSON)) {
         return this.context.req.json();
      }

      if (contentType.includes(CONTENT_TYPES.FORM_DATA) || 
          contentType.includes(CONTENT_TYPES.FORM_URLENCODED)) {
         const formBody = await this.context.req.parseBody();
         return this.parseFormDataWithJSON(formBody);
      }

      if (contentType.includes(CONTENT_TYPES.TEXT)) {
         return this.context.req.text();
      }

      return undefined;
   }

   private parseFormDataWithJSON(formBody: Record<string, any>): Record<string, any> {
      const result: Record<string, any> = {};

      for (const [key, value] of Object.entries(formBody)) {
         result[key] = typeof value === 'string' 
            ? this.parseStringValue(value) 
            : value;
      }

      return result;
   }

   private parseStringValue(value: string): any {
      const trimmed = value.trim();

      if (trimmed === '') return value;
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;

      // JSON structures
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
         try { return JSON.parse(trimmed); } catch { return value; }
      }

      // Numbers (but not leading zeros like IDs)
      if (!LEADING_ZERO_REGEX.test(trimmed) && 
          NUMBER_REGEX.test(trimmed) && 
          !isNaN(Number(trimmed))) {
         return Number(trimmed);
      }

      return value;
   }

   private extractFilesFromFormData(formData: FormData): Record<string, File | File[]> {
      const files: Record<string, File | File[]> = {};

      for (const [key, value] of formData.entries()) {
         const isFile = typeof value === 'object' && value !== null && ('name' in (value as any)) && ('size' in (value as any));
         if (isFile) {
            const fileValue = value as File;
            if (!files[key]) {
               files[key] = fileValue;
            } else if (Array.isArray(files[key])) {
               (files[key] as File[]).push(fileValue);
            } else {
               files[key] = [files[key] as File, fileValue];
            }
         }
      }

      return files;
   }
}
