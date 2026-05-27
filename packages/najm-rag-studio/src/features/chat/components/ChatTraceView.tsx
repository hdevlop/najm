import React from 'react';
import { Clock3, Cpu, AlertTriangle } from 'lucide-react';
import { Badge } from 'najm-ui';
import { ScrollArea } from 'najm-ui';
import { buildLabVisibleData } from '@/features/routing-lab/types';
import { LabMetrics, LabFinalTools, LabDependencies, LabConfirmations } from '@/features/routing-lab/components';
import { ToolCallList } from './ToolCallList';
import { KnowledgeChunkList } from './KnowledgeChunkList';
import type { StudioChatDebugResponse } from '@/features/chat/types';

interface ChatTraceViewProps {
  trace: StudioChatDebugResponse;
  expandedToolCalls: Set<string>;
  expandedChunks: Set<string>;
  toggleToolCall: (toolName: string) => void;
  toggleChunk: (chunkId: string) => void;
}

export function ChatTraceView({
  trace,
  expandedToolCalls,
  expandedChunks,
  toggleToolCall,
  toggleChunk,
}: ChatTraceViewProps) {
  const visible = trace.routing ? buildLabVisibleData(trace.routing) : null;

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-5">
        {/* Header metrics */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-txt-muted">
          {trace.latencyMs !== undefined && (
            <div className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{trace.latencyMs}ms</span>
            </div>
          )}
          {trace.provider && (
            <div className="inline-flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" />
              <span>
                {trace.provider}
                {trace.model ? ` / ${trace.model}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Routing trace */}
        {visible && (
          <>
            <LabMetrics
              elapsedMs={trace.latencyMs ?? null}
              matchesCount={visible.matches.length}
              dependenciesCount={visible.visibleDependencies.length}
              confirmationsCount={visible.confirmations.length}
            />
            <LabFinalTools
              finalTools={visible.finalTools}
              matchByTool={visible.matchByTool}
              scoreByTool={visible.scoreByTool}
              confirmationByTool={visible.confirmationByTool}
              status={trace.routing!.status}
            />
            <LabDependencies visibleDependencies={visible.visibleDependencies} />
            <LabConfirmations confirmations={visible.confirmations} />
          </>
        )}

        {/* Tool calls */}
        <ToolCallList
          toolCalls={trace.toolCalls}
          expandedToolCalls={expandedToolCalls}
          toggleToolCall={toggleToolCall}
        />

        {/* Knowledge chunks */}
        {trace.knowledge && trace.knowledge.used && (
          <KnowledgeChunkList
            chunks={trace.knowledge.chunks}
            expandedChunks={expandedChunks}
            toggleChunk={toggleChunk}
          />
        )}

        {/* Warnings */}
        {trace.warnings && trace.warnings.length > 0 && (
          <div className="rounded-xl border border-status-yellow/30 bg-status-yellow/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-status-yellow" />
              <h3 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">Warnings</h3>
            </div>
            <div className="space-y-2">
              {trace.warnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-status-yellow shrink-0 mt-0.5" />
                  <div>
                    <Badge variant="warning" className="text-[10px] uppercase mr-2">
                      {warning.code}
                    </Badge>
                    <span className="text-txt-secondary">{warning.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
