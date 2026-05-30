import React, { useEffect } from 'react';
import { DocumentList } from './DocumentList';
import { ChunkTable } from './ChunkTable';
import { DocumentInspector } from './DocumentInspector';
import { UploadSheet } from './UploadSheet';
import { ChatArea } from './ChatArea';
import { NInspectorSheet } from 'najm-ui';
import { SemanticBanner } from '@/features/routing-semantics/components/SemanticBanner';
import { useKnowledgeDocuments } from '../hooks/useKnowledgeDocuments';
import { useKnowledgeChunks } from '../hooks/useKnowledgeChunks';
import { useKnowledgeChat } from '../hooks/useKnowledgeChat';
import { useBanner } from '@/shared/hooks/useBanner';
import { NErrorBoundary } from 'najm-ui';
import type { KnowledgeView } from '@/shared/hooks/useWorkspace';
import type { DocumentListItem } from '@/features/knowledge/types';

interface KnowledgeWorkspaceProps {
  view: KnowledgeView;
  onCitationClick?: (chunkId: string, documentId: string) => void;
  onViewContextChange?: (context: Record<string, unknown>) => void;
}

export function KnowledgeWorkspace({ view, onCitationClick, onViewContextChange }: KnowledgeWorkspaceProps) {
  const { banner, showBanner, dismissBanner } = useBanner();
  const { documents, loading, uploadOpen, setUploadOpen, handleUpload, handleReindex, handleDelete, handleInspect, inspectingDoc, setInspectingDoc } = useKnowledgeDocuments(
    (msg) => showBanner('error', msg),
  );
  const { chunks, loadChunks, loadAllChunks, loading: chunksLoading } = useKnowledgeChunks();
  const { messages, loading: chatLoading, handleSend } = useKnowledgeChat();

  useEffect(() => {
    if (view === 'chunks') loadAllChunks();
  }, [view, loadAllChunks]);

  useEffect(() => {
    if (inspectingDoc) loadChunks(inspectingDoc.id);
  }, [inspectingDoc, loadChunks]);

  useEffect(() => {
    if (!onViewContextChange) return;
    onViewContextChange({
      view,
      documentCount: documents.length,
    });
  }, [view, documents.length, onViewContextChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0">
        <SemanticBanner banner={banner} onDismiss={dismissBanner} />
      </div>
      <div className="flex-1 overflow-hidden">
        <NErrorBoundary fallbackTitle="Knowledge view error">
          {view === 'documents' && (
            <DocumentList
              documents={documents}
              loading={loading}
              onUpload={() => setUploadOpen(true)}
              onReindex={handleReindex}
              onDelete={handleDelete}
              onInspect={handleInspect}
            />
          )}
          {view === 'chunks' && (
            <ChunkTable
              chunks={chunks}
              loading={chunksLoading}
              onChunkClick={(chunkId, documentId) => onCitationClick?.(chunkId, documentId)}
            />
          )}
          {view === 'chat' && (
            <ChatArea
              messages={messages}
              onSend={handleSend}
              loading={chatLoading}
              onCitationClick={onCitationClick}
            />
          )}
        </NErrorBoundary>
      </div>
      <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={handleUpload} />
      <NInspectorSheet
        open={!!inspectingDoc}
        onClose={() => setInspectingDoc(null)}
        title={inspectingDoc ? `${inspectingDoc.sourceType.toUpperCase()} Document` : 'Document'}
      >
        {inspectingDoc && (
          <DocumentInspector
            documentId={inspectingDoc.id}
            chunks={chunks}
            loading={false}
            onChunkClick={(chunkId) => onCitationClick?.(chunkId, inspectingDoc.id)}
          />
        )}
      </NInspectorSheet>
    </div>
  );
}
