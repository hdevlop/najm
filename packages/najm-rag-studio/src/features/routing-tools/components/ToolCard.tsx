import React from 'react';
import type { Row } from '@tanstack/react-table';
import { Badge, NDataCardShell } from 'najm-ui';
import type { MCPTool } from '@/features/routing-tools/types';

export function ToolCard({
  data,
  row,
  onClick,
  onContextMenu,
  isExpanded,
  onToggleExpanded,
  canExpand,
  renderSubRow,
}: {
  data: MCPTool;
  row: Row<MCPTool>;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  canExpand?: boolean;
  renderSubRow?: (row: MCPTool) => React.ReactNode;
}) {
  return (
    <NDataCardShell row={row} onClick={onClick} onContextMenu={onContextMenu} actions={undefined}>
      <div className="w-full text-left">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold text-txt-primary">{data.name}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-txt-muted">{data.description}</p>
          </div>
          <Badge
            variant={data.confirmation?.level === 'danger' ? 'destructive' : data.confirmation?.level === 'warning' ? 'warning' : 'outline'}
            className="shrink-0 rounded-md px-2 py-0.5 text-[10px] capitalize"
          >
            {data.confirmation?.level ?? 'safe'}
          </Badge>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge variant="outline" className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-mono uppercase text-txt-muted ring-border">
            {data.group}
          </Badge>
          <span className="text-xs text-txt-muted">{data.dependencies?.length ?? 0} deps</span>
        </div>
        {isExpanded && renderSubRow && (
          <div data-testid={`subrow-${data.id}`} className="mt-3 border-t pt-3">
            {renderSubRow(data)}
          </div>
        )}
      </div>
    </NDataCardShell>
  );
}
