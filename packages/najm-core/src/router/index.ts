// ============================================================================
// najm-router - HTTP Router Plugin
// ============================================================================

// ============================================
// PLUGIN FACTORY
// ============================================
export { router } from './RouterPlugin';

// ============================================
// SERVICES
// ============================================
export { RouterService } from './RouterService';
export { RequestParser } from './RequestParser';
export { ResponseFormatter } from './ResponseFormatter';
export { generateOpenAPI } from './openapi';
export type {
   OpenAPIDocument,
   OpenAPIGenerateOptions,
   OpenAPIOperation,
   OpenAPIParameter,
} from './openapi';

// ============================================
// DECORATORS
// ============================================
export * from './decorator';

// ============================================
// RESPONSE UTILITIES
// ============================================
export {
   // Decorators
   ResMsg,
   ResCreated,
   ResNoContent,
   RawResponse,
   RawController,
   
   // Helper functions
   ok,
   created,
   updated,
   deleted,
   paginated,
   
   // Utilities
   getResponseMessage,
   isI18nKey,
   resolveMessage,
   isRawResponse,
   isRawController,
   shouldSkipWrapping,
   
   // Tokens
   RES_MSG_META,
   RES_OPTIONS_META,
   RAW_RESPONSE_META,
   RAW_CONTROLLER_META,
} from './response';

export type {
   ResponseMessageOptions,
   WrappedResponse,
   ResponseConfig,
} from './response';

// ============================================
// TOKENS
// ============================================
export { ROUTER_CONFIG } from './tokens';

// ============================================
// TYPES
// ============================================
export type {
   HttpMethod,
   ControllerOptions,
   RouteDefinition,
   RouteEntry,
   RouterPluginConfig,
   HRequest,
   ValidFunction,
} from './types';
