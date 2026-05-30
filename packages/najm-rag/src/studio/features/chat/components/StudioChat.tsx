import React, { useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Trash2, FlaskConical, TestTube, Tag, Copy, Check, Activity, Settings, Sparkles } from 'lucide-react';
import { AiSettingsPanel } from 'najm-chatbot/react';
import { Button } from 'najm-ui';
import { Input } from 'najm-ui';
import { ScrollArea } from 'najm-ui';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from 'najm-ui';
import { NPageHeader } from 'najm-ui';
import { UserMessage } from './UserMessage';
import { ChatTraceView } from './ChatTraceView';
import { ChatSetupState } from './ChatSetupState';
import { useStudioChat } from '../hooks/useStudioChat';
import { useChatTrace } from '../hooks/useChatTrace';
import { useCrossFeatureDrafts } from '../hooks/useCrossFeatureDrafts';
import { useRagStudio } from '@/lib/context';
import type { ChatDebugMessage } from '../hooks/useStudioChat';
import type { StudioChatDebugError } from '@/features/chat/types';

interface StudioChatProps {
  onNavigate: (workspace: string) => void;
  onOpenSettings?: () => void;
}

export function StudioChat({ onNavigate, onOpenSettings }: StudioChatProps) {
  const { messages, isLoading, error, sessionKey, send, clear } = useStudioChat();
  const { chatbotSettingsUrl, chatbotSettingsApiPath, chatbotSettingsTestApiPath } = useRagStudio();
  const {
    selectedMessageId,
    expandedToolCalls,
    expandedChunks,
    toggleToolCall,
    toggleChunk,
    selectMessage,
  } = useChatTrace();
  const {
    openInLab,
    createTest,
    createSemanticPhrase,
  } = useCrossFeatureDrafts(onNavigate);

  const [inputValue, setInputValue] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [chatbotSettingsOpen, setChatbotSettingsOpen] = React.useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    send(inputValue.trim());
    setInputValue('');
  }, [inputValue, isLoading, send]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleCopy = useCallback(async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }, []);

  const lastErrorMsg = messages.find(m => m.error && !m.isLoading);
  const setupError: StudioChatDebugError | null = lastErrorMsg?.error ?? null;

  const selectedTrace = messages.find(m => m.id === selectedMessageId)?.trace;
  const openChatbotSettings = useCallback(() => {
    if (chatbotSettingsApiPath !== null) {
      setChatbotSettingsOpen(true);
      return;
    }
    if (chatbotSettingsUrl) {
      window.location.href = chatbotSettingsUrl;
      return;
    }
    onOpenSettings?.();
  }, [chatbotSettingsApiPath, chatbotSettingsUrl, onOpenSettings]);
  const settingsApiPath = chatbotSettingsApiPath ?? '/api/ai-settings';

  return (
    <>
    <div className="flex h-full min-h-0">
      {/* Main chat area */}
      <div className="flex min-h-0 flex-1 flex-col min-w-0">
        <NPageHeader
          icon={MessageSquare}
          title="Chat Debug"
          subtitle="Debug the RAG pipeline"
          contentClassName="flex-1 min-h-0 overflow-hidden"
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={openChatbotSettings} className="gap-1.5 px-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={clear} className="gap-1.5 px-2">
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            </>
          }
        >
          <div className="flex h-full min-h-0 flex-col">
            {/* Messages */}
            <ScrollArea className="min-h-0 flex-1 p-4 sm:p-5">
              {setupError && messages.length <= 2 ? (
                <ChatSetupState error={setupError} onOpenSettings={openChatbotSettings} />
              ) : messages.length === 0 ? (
                <ChatEmptyState />
              ) : (
                <div className="space-y-5">
                  {messages.map((msg) => (
                    <MessageRow
                      key={msg.id}
                      msg={msg}
                      isSelected={selectedMessageId === msg.id}
                      copiedId={copiedId}
                      onSelect={selectMessage}
                      onCopy={handleCopy}
                      onOpenInLab={openInLab}
                      onCreateTest={createTest}
                      onCreateSemanticPhrase={createSemanticPhrase}
                      allMessages={messages}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="shrink-0 border-t border-border bg-bg/95 p-3 backdrop-blur sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Input
                  id="rag-studio-chat-input"
                  name="rag-studio-chat-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  disabled={isLoading}
                  className="min-w-0 flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim()}
                  className="shrink-0 gap-1.5 px-3 sm:px-4"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </div>
              {sessionKey && (
                <p className="mt-2 text-xs text-txt-muted">
                  Session: <span className="font-mono">{sessionKey.slice(0, 8)}...</span>
                </p>
              )}
            </div>
          </div>
        </NPageHeader>
      </div>

      {/* Trace inspector */}
      {selectedTrace && (
        <div className="hidden lg:flex w-[420px] shrink-0 border-l border-border flex-col">
          <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-semibold text-txt-primary">Trace Inspector</h3>
            </div>
            <button
              onClick={() => selectMessage(null)}
              className="text-xs text-txt-muted hover:text-txt-primary transition-colors"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatTraceView
              trace={selectedTrace}
              expandedToolCalls={expandedToolCalls}
              expandedChunks={expandedChunks}
              toggleToolCall={toggleToolCall}
              toggleChunk={toggleChunk}
            />
          </div>
        </div>
      )}
    </div>
    <Sheet open={chatbotSettingsOpen} onOpenChange={setChatbotSettingsOpen}>
      <SheetContent
        side="right"
        portalClassName="rs-studio"
        className="flex h-dvh max-h-dvh w-[min(520px,calc(100vw-1rem))] flex-col overflow-hidden p-0"
        style={{ maxWidth: 'calc(100vw - 1rem)' }}
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle>Chatbot Settings</SheetTitle>
          <SheetDescription>
            Configure the assistant used by Chat Debug.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-bg dark [--ncb-primary:#7c3aed] [--ncb-radius:8px]">
          <AiSettingsPanel
            settingsApiPath={settingsApiPath}
            testApiPath={chatbotSettingsTestApiPath}
            theme={{ primary: '#7c3aed', radius: '8px' }}
            className="flex min-h-full flex-col"
          />
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}

interface MessageRowProps {
  msg: ChatDebugMessage;
  isSelected: boolean;
  copiedId: string | null;
  onSelect: (msg: ChatDebugMessage | null) => void;
  onCopy: (content: string, id: string) => void;
  onOpenInLab: (query: string) => void;
  onCreateTest: (query: string, expectedTools: string[]) => void;
  onCreateSemanticPhrase: (toolName: string, phrase: string) => void;
  allMessages: ChatDebugMessage[];
}

function MessageRow({
  msg,
  isSelected,
  copiedId,
  onSelect,
  onCopy,
  onOpenInLab,
  onCreateTest,
  onCreateSemanticPhrase,
  allMessages,
}: MessageRowProps) {
  if (msg.role === 'user') {
    const msgIndex = allMessages.findIndex((m) => m.id === msg.id);
    const nextAssistant = allMessages
      .slice(msgIndex + 1)
      .find((m) => m.role === 'assistant' && m.trace);
    const trace = nextAssistant?.trace;

    return (
      <div className="space-y-1.5">
        <UserMessage content={msg.content} />
        <div className="flex justify-end gap-1">
          <ActionButton
            onClick={() => onOpenInLab(msg.content)}
            icon={<FlaskConical className="h-3 w-3" />}
            label="Open In Lab"
          />
          <ActionButton
            onClick={() => {
              const tools = trace?.routing?.finalTools ?? [];
              onCreateTest(msg.content, tools);
            }}
            icon={<TestTube className="h-3 w-3" />}
            label="Create Test"
          />
          <ActionButton
            onClick={() => {
              const toolName = trace?.routing?.finalTools?.[0] ?? '';
              if (toolName) onCreateSemanticPhrase(toolName, msg.content);
            }}
            icon={<Tag className="h-3 w-3" />}
            label="Create Semantic Phrase"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`space-y-1.5 ${isSelected ? 'ring-1 ring-brand/30 rounded-lg p-2 -m-2 bg-brand/5' : ''}`}
    >
      <div className="flex flex-col gap-2">
          <div className="max-w-[92%] rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed text-txt-primary whitespace-pre-wrap sm:max-w-[80%]">
          {msg.isLoading ? (
            <span className="inline-flex items-center gap-2 text-txt-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
              Thinking...
            </span>
          ) : msg.error ? (
            <span className="text-status-red">{msg.error?.error}</span>
          ) : (
            msg.content
          )}
        </div>
        {!msg.isLoading && !msg.error && (
          <div className="flex flex-wrap gap-1">
            <ActionButton
              onClick={() => onSelect(isSelected ? null : msg)}
              icon={<Activity className="h-3 w-3" />}
              label={isSelected ? 'Hide Trace' : 'Show Trace'}
            />
            <ActionButton
              onClick={() => onCopy(msg.content, msg.id)}
              icon={copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              label={copiedId === msg.id ? 'Copied' : 'Copy Answer'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-txt-muted transition-colors hover:bg-card-hover hover:text-txt-primary"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ChatEmptyState() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-3 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-txt-primary">Ready to debug</h3>
      <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-txt-muted">
        Ask a question to inspect routing, tool calls, and the assistant response.
      </p>
    </div>
  );
}
