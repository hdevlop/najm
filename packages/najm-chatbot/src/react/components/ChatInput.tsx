'use client';

import { type KeyboardEvent } from 'react';
import { SendHorizontal, Square } from 'lucide-react';
import { cn } from '../lib/cn';
import type { ChatbotSlots, I18nFn, InputSlotProps } from '../types';

interface ChatInputProps extends InputSlotProps {
  slots?: Partial<ChatbotSlots>;
}

function DefaultInput({ input, isLoading, onChange, onSubmit, onStop, t }: InputSlotProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit(event);
    }
  };

  return (
    <form
      onSubmit={(event) => onSubmit(event)}
      className="border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-end gap-2 rounded-[var(--ncb-radius)] border border-zinc-200 bg-white p-1.5 shadow-sm focus-within:border-[var(--ncb-primary)] dark:border-zinc-800 dark:bg-zinc-900">
        <textarea
          value={input}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('Ask anything')}
          disabled={isLoading}
          rows={1}
          className={cn(
            'min-h-10 max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-white',
            'disabled:cursor-not-allowed disabled:opacity-70',
          )}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
            title={t('Stop')}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--ncb-primary)] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            title={t('Send')}
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}

export function ChatInput(props: ChatInputProps) {
  const Input = props.slots?.Input ?? DefaultInput;
  return <Input {...props} />;
}
