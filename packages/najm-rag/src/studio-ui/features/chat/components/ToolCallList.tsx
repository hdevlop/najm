import React from 'react';
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, NCard } from 'najm-kit';
import { ChevronDown, ChevronRight, Wrench, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { JsonViewer as StudioJsonViewer } from 'najm-kit/json';
import type { StudioChatDebugResponse, JsonViewColors } from '@/features/chat/types';
import { defaultJsonViewColors } from '@/features/routing-semantics/utils/json-view-presets';

interface ToolCallListProps {
  toolCalls: StudioChatDebugResponse['toolCalls'];
  expandedToolCalls: Set<string>;
  toggleToolCall: (toolName: string) => void;
  colors?: JsonViewColors;
}

export function ToolCallList({ toolCalls, expandedToolCalls, toggleToolCall, colors = defaultJsonViewColors }: ToolCallListProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <NCard title="Tool Calls" icon={Wrench} iconColor="text-brand">
      <div className="space-y-2">
        {toolCalls.map((call, idx) => {
          const isExpanded = expandedToolCalls.has(call.toolName + idx);
          return (
            <Collapsible
              key={call.toolName + idx}
              open={isExpanded}
              onOpenChange={() => toggleToolCall(call.toolName + idx)}
              className="overflow-hidden rounded-lg border border-border bg-background"
            >
              <CollapsibleTrigger className="flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-accent/50">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                )}
                <Wrench className="h-4 w-4 text-txt-muted mr-2 shrink-0" />
                <span className="text-sm font-medium text-txt-primary flex-1">{call.toolName}</span>
                <Badge
                  variant={
                    call.status === 'success'
                      ? 'success'
                      : call.status === 'error'
                      ? 'destructive'
                      : 'warning'
                  }
                  className="ml-2 text-xs capitalize"
                >
                  {call.status === 'success' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {call.status === 'error' && <XCircle className="h-3 w-3 mr-1" />}
                  {call.status === 'blocked' && <ShieldAlert className="h-3 w-3 mr-1" />}
                  {call.status}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2 border-t border-border">
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-txt-muted uppercase">Arguments</span>
                    <div className="mt-1">
                      <StudioJsonViewer value={call.args} colors={colors} />
                    </div>
                  </div>
                  {call.resultPreview !== undefined && (
                    <div>
                      <span className="text-xs font-semibold text-txt-muted uppercase">Result Preview</span>
                      <div className="mt-1">
                        <StudioJsonViewer value={call.resultPreview} colors={colors} />
                      </div>
                    </div>
                  )}
                  {call.error && (
                    <div className="flex items-start gap-2 text-status-red">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="text-sm">{call.error}</span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </NCard>
  );
}
