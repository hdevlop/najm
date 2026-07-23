import type { Context } from 'hono';
import { RequestParser } from '../router/RequestParser';
import type { HRequest } from './types';

const parsers = new WeakMap<Context, RequestParser>();
const requests = new WeakMap<Context, HRequest>();

export function getRequestParser(context: Context): RequestParser {
   let parser = parsers.get(context);

   if (!parser) {
      parser = new RequestParser(context);
      parsers.set(context, parser);
   }

   return parser;
}

export function getRequestData(context: Context): HRequest {
   let request = requests.get(context);

   if (!request) {
      request = getRequestParser(context).createRequest();
      requests.set(context, request);
   }

   return request;
}

export function clearRequestContextCache(context: Context): void {
   parsers.delete(context);
   requests.delete(context);
}
