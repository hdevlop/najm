// owner: providers (used by app-level consumers)
// WhatsApp Studio mounting / provider configuration types

export interface StudioConfig {
  apiBase: string;
  getAuthHeaders: () => Record<string, string> | Promise<Record<string, string>>;
  /**
   * Called when the API returns 401/403. Use this to trigger a re-login flow
   * (e.g., refresh the token or redirect to the host app's login page).
   */
  onUnauthorized?: () => void;
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