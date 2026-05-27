declare module 'najm-rag-studio' {
  import type { CSSProperties, ReactNode } from 'react';

  export interface RagStudioProviderProps {
    apiBase: string;
    basePath?: string;
    getAuthHeaders?: () => HeadersInit;
    chatbotSettingsUrl?: string;
    chatbotSettingsApiPath?: string | null;
    chatbotSettingsTestApiPath?: string;
    appearance?: {
      className?: string;
      style?: CSSProperties;
    };
    children: ReactNode;
  }

  export function RagStudioProvider(props: RagStudioProviderProps): JSX.Element;
  export function RagStudio(): JSX.Element;

  export interface EmbeddingHealthResult {
    ok: boolean;
    provider: string;
    baseUrl: string;
    model: string;
    error?: string;
    latencyMs: number;
  }

  export function useEmbeddingHealth(intervalMs?: number): {
    health: EmbeddingHealthResult;
    checking: boolean;
    recheck: () => Promise<void>;
  };

  export interface EmbeddingHealthBannerProps {
    health: EmbeddingHealthResult | null;
    checking?: boolean;
    onRecheck?: () => void | Promise<void>;
  }

  export function EmbeddingHealthBanner(props: EmbeddingHealthBannerProps): JSX.Element;
  export function EmbeddingHealthRoot(): JSX.Element;
}

declare module 'najm-rag-studio/styles.css';
