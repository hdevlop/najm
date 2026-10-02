import React, { useState } from 'react';
import type { DocumentChunkResponse } from '@/features/knowledge/types';
import { Badge } from 'najm-kit';
import { Button } from 'najm-kit';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { NPageHeader } from 'najm-kit';

interface DocumentInspectorProps {
  documentId: string;
  chunks: DocumentChunkResponse[];
  loading: boolean;
  onChunkClick?: (chunkId: string) => void;
}

const PAGE_SIZE = 10;

export function DocumentInspector({ documentId, chunks, loading, onChunkClick }: DocumentInspectorProps) {
  const [page, setPage] = useState(0);

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-4 w-1/3 bg-card rounded animate-pulse" />
        <div className="h-4 w-1/4 bg-card rounded animate-pulse" />
        <div className="space-y-2 mt-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-card rounded-lg animate-pulse border border-border" />
          ))}
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(chunks.length / PAGE_SIZE);
  const pageChunks = chunks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <NPageHeader
        icon={FileText}
        title="Document Chunks"
        subtitle={`${chunks.length} total chunks`}
      />
      <div className="p-5 space-y-2">
        {pageChunks.map((chunk) => (
          <button
            key={chunk.id}
            onClick={() => onChunkClick?.(chunk.id)}
            className="w-full text-left p-4 bg-card border border-border rounded-xl hover:border-brand/40 hover:bg-card-hover transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-md">
                  Chunk {chunk.ordinal + 1}
                </span>
                {chunk.page !== null && (
                  <Badge variant="outline" className="text-sm font-mono">p.{chunk.page + 1}</Badge>
                )}
              </div>
              <span className="text-sm text-txt-muted font-mono">{chunk.tokens} tokens</span>
            </div>
            <p className="text-sm text-txt-secondary line-clamp-2 group-hover:text-txt-primary transition-colors leading-relaxed">{chunk.text}</p>
          </button>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <span className="text-sm text-txt-muted font-mono">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </>
  );
}
