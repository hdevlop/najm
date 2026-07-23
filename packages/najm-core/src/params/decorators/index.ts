// ============================================================================
// decorators/all.ts - All decorators defined in one place (alternative approach)
// ============================================================================

import { createParamDecorator } from './factory';
export { getParameterMetadata } from '../metadata';

// This approach defines all decorators from a configuration object
// Advantages: Single source of truth, easy to add new decorators
// Disadvantages: Less modular than separate files

// Body decorators
export const Body = createParamDecorator('body');
export const JsonBody = createParamDecorator('json');
export const TextBody = createParamDecorator('text');
export const FormData = createParamDecorator('formData');
export const ArrayBufferBody = createParamDecorator('arrayBuffer');
export const BlobBody = createParamDecorator('blob');

// URL/Route decorators
export const Params = createParamDecorator('params');
export const Query = createParamDecorator('query');
export const Queries = createParamDecorator('queries');
export const Path = createParamDecorator('path');
export const Url = createParamDecorator('url');
export const Method = createParamDecorator('method');
export const RoutePath = createParamDecorator('routePath');
export const MatchedRoutes = createParamDecorator('matchedRoutes');
export const RouteIndex = createParamDecorator('routeIndex');

// Header decorators
export const Headers = createParamDecorator('headers');
export const ContentType = createParamDecorator('contentType');
export const ContentLength = createParamDecorator('contentLength');
export const Origin = createParamDecorator('origin');
export const Referer = createParamDecorator('referer');
export const Language = createParamDecorator('language');
export const Encoding = createParamDecorator('encoding');
export const Connection = createParamDecorator('connection');
export const Upgrade = createParamDecorator('upgrade');
export const Protocol = createParamDecorator('protocol');

// Context and request decorators
export const Ctx = createParamDecorator('context');
export const Req = createParamDecorator('req');
export const File = createParamDecorator('file');
export const IP = createParamDecorator('ip');
export const Raw = createParamDecorator('raw');
export const Valid = createParamDecorator('valid');

// Guard-related decorators
export const User = createParamDecorator('user');
export const Owner = createParamDecorator('owner');
export const Info = createParamDecorator('info');
export const Data = createParamDecorator('data');
export const Filter = createParamDecorator('filter');
export const GuardParams = createParamDecorator('guardParams');

// Authorization decorators
export const Role = createParamDecorator('role');
export const Permissions = createParamDecorator('permissions');

export type { ParameterMetadata } from '../types';
