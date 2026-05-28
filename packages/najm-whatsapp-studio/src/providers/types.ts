// owner: providers (used by app-level consumers)
// WhatsApp Studio mounting / provider configuration types

export interface StudioConfig {
  apiBase: string;
  getAuthHeaders: () => Record<string, string> | Promise<Record<string, string>>;
  onUnauthorized?: () => void;
  basePath?: string;
}

// Forward declaration — ApiClient is created by lib/api and stored in context
export interface ApiClient {
  get: (path: string) => Promise<any>;
  post: (path: string, body?: any) => Promise<any>;
  patch: (path: string, body?: any) => Promise<any>;
  del: (path: string) => Promise<any>;
}

export interface StudioContextValue extends StudioConfig {
  client: ApiClient;
  selectedInstanceId: string | null;
  setSelectedInstanceId: (id: string | null) => void;
  basePath: string;
}

export type PanelId =
  | 'dashboard'
  | 'instances'
  | 'conversations'
  | 'contacts'
  | 'groups'
  | 'chat-ops'
  | 'labels'
  | 'bot'
  | 'profile'
  | 'webhooks'
  | 'settings';