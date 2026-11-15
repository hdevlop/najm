import React from 'react';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, NCard } from 'najm-kit';
import type { StudioChatDebugResponse } from '@/features/chat/types';

interface KnowledgeChunkListProps {
  chunks: NonNullable<StudioChatDebugResponse['knowledge']>['chunks'];
  expandedChunks: Set<string>;
  toggleChunk: (chunkId: string) => void;
}

export function KnowledgeChunkList({ chunks, expandedChunks, toggleChunk }: KnowledgeChunkListProps) {
  if (!chunks || chunks.length === 0) return null;

  return (
    <NCard title="Knowledge Chunks" icon={BookOpen} iconColor="text-status-green">
      <div className="space-y-2">
        {chunks.map((chunk) => {
          const isExpanded = expandedChunks.has(chunk.chunkId);
          return (
            <Collapsible
              key={chunk.chunkId}
              open={isExpanded}
              onOpenChange={() => toggleChunk(chunk.chunkId)}
              className="overflow-hidden rounded-lg border border-border bg-background"
            >
              <CollapsibleTrigger className="flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-accent/50">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                )}
                <BookOpen className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                <span className="text-sm text-txt-secondary flex-1 truncate">
                  {chunk.source ?? chunk.documentId}
                </span>
                <Badge variant="success" className="ml-2 font-mono">
                  {(chunk.score * 100).toFixed(1)}%
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 border-t border-border">
                  <p className="pt-2 text-sm text-txt-primary leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-txt-muted font-mono">
                    <span>chunk: {chunk.chunkId}</span>
                    <span>·</span>
                    <span>doc: {chunk.documentId}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </NCard>
  );
}
