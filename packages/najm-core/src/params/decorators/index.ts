// ============================================================================
// decorators/all.ts - All decorators defined in one place (alternative approach)
// ============================================================================

import { createBuiltInParamDecorator } from './factory';
export { createParamDecorator } from './factory';
export { getParameterMetadata } from '../metadata';

// This approach defines all decorators from a configuration object
// Advantages: Single source of truth, easy to add new decorators
// Disadvantages: Less modular than separate files

// Body decorators
export const Body = createBuiltInParamDecorator('body');
export const JsonBody = createBuiltInParamDecorator('json');
export const TextBody = createBuiltInParamDecorator('text');
export const FormData = createBuiltInParamDecorator('formData');
export const ArrayBufferBody = createBuiltInParamDecorator('arrayBuffer');
export const BlobBody = createBuiltInParamDecorator('blob');

// URL/Route decorators
export const Params = createBuiltInParamDecorator('params');
export const Query = createBuiltInParamDecorator('query');
export const Queries = createBuiltInParamDecorator('queries');
export const Path = createBuiltInParamDecorator('path');
export const Url = createBuiltInParamDecorator('url');
export const Method = createBuiltInParamDecorator('method');
export const RoutePath = createBuiltInParamDecorator('routePath');
export const MatchedRoutes = createBuiltInParamDecorator('matchedRoutes');
export const RouteIndex = createBuiltInParamDecorator('routeIndex');

// Header decorators
export const Headers = createBuiltInParamDecorator('headers');
export const ContentType = createBuiltInParamDecorator('contentType');
export const ContentLength = createBuiltInParamDecorator('contentLength');
export const Origin = createBuiltInParamDecorator('origin');
export const Referer = createBuiltInParamDecorator('referer');
export const Language = createBuiltInParamDecorator('language');
export const Encoding = createBuiltInParamDecorator('encoding');
export const Connection = createBuiltInParamDecorator('connection');
export const Upgrade = createBuiltInParamDecorator('upgrade');
export const Protocol = createBuiltInParamDecorator('protocol');

// Context and request decorators
export const Ctx = createBuiltInParamDecorator('context');
export const Req = createBuiltInParamDecorator('req');
export const File = createBuiltInParamDecorator('file');
export const IP = createBuiltInParamDecorator('ip');
export const Raw = createBuiltInParamDecorator('raw');
export const Valid = createBuiltInParamDecorator('valid');

// Guard-related decorators
export const User = createBuiltInParamDecorator('user');
export const Owner = createBuiltInParamDecorator('owner');
export const Info = createBuiltInParamDecorator('info');
export const Data = createBuiltInParamDecorator('data');
export const Filter = createBuiltInParamDecorator('filter');
export const GuardParams = createBuiltInParamDecorator('guardParams');

// Authorization decorators
export const Role = createBuiltInParamDecorator('role');
export const Permissions = createBuiltInParamDecorator('permissions');

export type { ParameterMetadata } from '../types';
