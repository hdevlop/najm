import React from 'react';
import { Badge } from 'najm-kit';
import type { MCPTool } from '@/features/routing-tools/types';

interface ToolParameterListProps {
  params: MCPTool['parameters'];
}

export function ToolParameterList({ params }: ToolParameterListProps) {
  const safeParams = params ?? [];

  if (safeParams.length === 0) {
    return <p className="text-sm text-txt-muted">No parameters detected</p>;
  }

  const smartParams = safeParams.filter((p) => p.smartResolver);
  const regularParams = safeParams.filter((p) => !p.smartResolver);

  return (
    <div className="space-y-3">
      {smartParams.map((p) => (
        <div
          key={p.name}
          className="rounded-lg border border-border bg-surface/40 p-4 space-y-3"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-txt-primary">{p.name}</span>
            <span className="text-xs font-mono text-txt-muted">{p.type}</span>
            {p.required ? (
              <span className="text-[10px] font-semibold text-status-red/80 uppercase tracking-wider">
                req
              </span>
            ) : (
              <span className="text-[10px] text-txt-muted uppercase tracking-wider">opt</span>
            )}
            <Badge variant="success" className="rounded-md text-[10px] uppercase tracking-wider">
              smart resolve
            </Badge>
          </div>

          {p.smartResolver && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-txt-muted">Accepts</span>
                {p.smartResolver.accepts.map((accept) => (
                  <Badge key={accept} variant="outline" className="rounded-md text-[10px]">
                    {accept}
                  </Badge>
                ))}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-txt-muted block">
                  Examples
                </span>
                <div className="space-y-1">
                  {p.smartResolver.examples.map((example) => (
                    <code
                      key={example}
                      className="block rounded bg-bg px-2 py-1 text-[11px] text-txt-secondary font-mono"
                    >
                      {`"${p.name}": "${example}"`}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {regularParams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {regularParams.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 px-3 py-2.5"
            >
              <span className="text-sm font-semibold text-txt-primary">{p.name}</span>
              <span className="text-xs font-mono text-txt-muted">{p.type}</span>
              {p.required ? (
                <span className="text-[10px] font-semibold text-status-red/80 uppercase tracking-wider">
                  req
                </span>
              ) : (
                <span className="text-[10px] text-txt-muted uppercase tracking-wider">opt</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
