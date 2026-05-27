import type { ComponentType, CSSProperties, ReactNode } from 'react';
import type { UIMessage } from 'ai';
import type { AiSettingsRecord } from './hooks/useAiSettings';

export interface ChatbotSuggestion {
  label: string;
  text: string;
  icon?: ComponentType<{ className?: string }>;
}

export type ChatbotSuggestionInput = string | ChatbotSuggestion;

export type ChatbotView = 'chat' | 'settings';
export type ChatbotStatus = 'ready' | 'empty-tools' | 'disabled';
export type ChatbotSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ChatbotTheme {
  primary?: string;
  radius?: string;
  accent?: string;
  codeBg?: string;
}

export type I18nFn = (key: string) => string;

export interface ChatbotSlots {
  Trigger: ComponentType<TriggerSlotProps>;
  Header: ComponentType<HeaderSlotProps>;
  EmptyState: ComponentType<EmptyStateSlotProps>;
  Message: ComponentType<MessageSlotProps>;
  Input: ComponentType<InputSlotProps>;
}

export interface TriggerSlotProps {
  open: boolean;
  status: ChatbotStatus;
  onToggle: () => void;
  t: I18nFn;
}

export interface HeaderSlotProps {
  view: ChatbotView;
  settings: AiSettingsRecord | null;
  status: ChatbotStatus;
  hasMessages: boolean;
  size: ChatbotSize;
  onClose: () => void;
  onClear: () => void;
  onViewChange: (view: ChatbotView) => void;
  onSizeChange: (size: ChatbotSize) => void;
  t: I18nFn;
}

export interface EmptyStateSlotProps {
  suggestions: ChatbotSuggestion[];
  onSuggestion: (text: string) => void;
  t: I18nFn;
}

export interface MessageSlotProps {
  message: UIMessage;
  text: string;
  isAssistant: boolean;
  children: ReactNode;
  onCopy: () => void;
  t: I18nFn;
}

export interface InputSlotProps {
  input: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: (event?: { preventDefault?: () => void }) => void;
  onStop: () => void;
  t: I18nFn;
}

export interface ChatbotProps {
  suggestions?: ChatbotSuggestionInput[];
  apiPath?: string;
  settingsApiPath?: string;
  mcpApiPath?: string;
  testApiPath?: string;
  sessionKey?: string;
  initialOpen?: boolean;
  initialSize?: ChatbotSize;
  persistSize?: boolean;
  slots?: Partial<ChatbotSlots>;
  theme?: ChatbotTheme;
  i18n?: I18nFn;
  className?: string;
  panelClassName?: string;
  style?: CSSProperties;
}
