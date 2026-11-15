import React, { useState } from 'react';
import type { DocumentChunkResponse } from '@/features/knowledge/types';
import { Badge, Button, NCard, NEmptyState, NSkeleton } from 'najm-kit';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';

interface DocumentInspectorProps {
  documentId: string;
  chunks: DocumentChunkResponse[];
  loading: boolean;
  onChunkClick?: (chunkId: string) => void;
}

const PAGE_SIZE = 10;

export function DocumentInspector({ chunks, loading, onChunkClick }: DocumentInspectorProps) {
  const [page, setPage] = useState(0);

  if (loading) {
    return (
      <div className="space-y-3 p-4" role="status" aria-label="Loading chunks">
        <NSkeleton className="h-4 w-1/3" />
        {Array.from({ length: 5 }, (_, i) => (
          <NSkeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="p-4">
        <NEmptyState icon={Layers} title="No chunks" description="This document has not produced any chunks yet." />
      </div>
    );
  }

  const totalPages = Math.ceil(chunks.length / PAGE_SIZE);
  const pageChunks = chunks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col">
      <p className="px-4 pt-4 text-sm text-txt-secondary">{chunks.length} total chunks</p>
      <div className="space-y-2 p-4">
        {pageChunks.map((chunk) => (
          <NCard
            key={chunk.id}
            onClick={onChunkClick ? () => onChunkClick(chunk.id) : undefined}
            className="group cursor-pointer transition-colors hover:border-brand/40 hover:bg-accent/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-brand">Chunk {chunk.ordinal + 1}</Badge>
                {chunk.page !== null && (
                  <Badge variant="outline" className="font-mono">p.{chunk.page + 1}</Badge>
                )}
              </div>
              <span className="font-mono text-xs text-txt-muted">{chunk.tokens} tokens</span>
            </div>
            <p className="line-clamp-2 text-sm leading-relaxed text-txt-secondary transition-colors group-hover:text-txt-primary">{chunk.text}</p>
          </NCard>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
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
          <span className="font-mono text-sm text-txt-muted">
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
    </div>
  );
}
