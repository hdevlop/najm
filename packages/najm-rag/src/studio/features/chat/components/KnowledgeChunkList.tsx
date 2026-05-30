import React from 'react';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import type { StudioChatDebugResponse } from '@/features/chat/types';

interface KnowledgeChunkListProps {
  chunks: StudioChatDebugResponse['knowledge']['chunks'];
  expandedChunks: Set<string>;
  toggleChunk: (chunkId: string) => void;
}

export function KnowledgeChunkList({ chunks, expandedChunks, toggleChunk }: KnowledgeChunkListProps) {
  if (!chunks || chunks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-1 rounded-full bg-status-green" />
        <h3 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">Knowledge Chunks</h3>
      </div>
      <div className="space-y-2">
        {chunks.map((chunk) => {
          const isExpanded = expandedChunks.has(chunk.chunkId);
          return (
            <div key={chunk.chunkId} className="rounded-lg border border-border bg-bg overflow-hidden">
              <button
                onClick={() => toggleChunk(chunk.chunkId)}
                className="flex items-center w-full px-3 py-2 text-left hover:bg-card-hover transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                )}
                <BookOpen className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                <span className="text-sm text-txt-secondary flex-1 truncate">
                  {chunk.source ?? chunk.documentId}
                </span>
                <span className="text-xs font-mono text-status-green bg-status-green/10 px-2 py-0.5 rounded-md ml-2">
                  {(chunk.score * 100).toFixed(1)}%
                </span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-border">
                  <p className="pt-2 text-sm text-txt-primary leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-txt-muted font-mono">
                    <span>chunk: {chunk.chunkId}</span>
                    <span>·</span>
                    <span>doc: {chunk.documentId}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
