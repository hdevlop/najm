import React from 'react';

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="bg-brand text-white rounded-lg px-3 py-2 max-w-[80%] text-sm">
        {content}
      </div>
    </div>
  );
}
