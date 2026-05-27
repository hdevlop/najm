import React, { useState, useMemo } from 'react';
import { Shield, ScrollText, KeyRound, Filter } from 'lucide-react';
import { Badge } from 'najm-ui';
import { NativeSelect as Select } from 'najm-ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from 'najm-ui';
import { NPageHeader } from 'najm-ui';
import type { AuditLogEntry } from '@/features/logs/types';

interface AccessSettingsProps {
  accessMode: string;
  auditLogs: AuditLogEntry[];
  loading: boolean;
}

export function AccessSettings({ accessMode, auditLogs, loading }: AccessSettingsProps) {
  const [actionFilter, setActionFilter] = useState<string>('');

  const uniqueActions = useMemo(() => {
    const actions = new Set(auditLogs.map((log) => log.action));
    return Array.from(actions).sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    if (!actionFilter) return auditLogs;
    return auditLogs.filter((log) => log.action === actionFilter);
  }, [auditLogs, actionFilter]);

  return (
    <NPageHeader
      icon={KeyRound}
      title="Access / Audit"
      subtitle="Authentication and activity logs"
    >
      <div className="p-5 space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-brand" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-txt-primary">Access Mode</p>
            <p className="text-sm text-txt-muted mt-0.5">How administrators authenticate to RAG Studio</p>
          </div>
          <Badge variant="default" className="uppercase text-sm font-semibold">{accessMode}</Badge>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 h-14 border-b border-border">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-txt-muted" />
              <h3 className="text-sm font-semibold text-txt-primary">Audit Log</h3>
            </div>
            {uniqueActions.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-txt-muted" />
                <Select
                  options={uniqueActions.map((a) => ({ value: a, label: a }))}
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  placeholder="All actions"
                  className="w-40 text-sm h-8"
                />
              </div>
            )}
          </div>
          <div className="p-1">
            {loading ? (
              <div className="text-sm text-txt-muted py-8 text-center">Loading audit entries...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-txt-muted">
                <ScrollText className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{actionFilter ? 'No entries for selected action' : 'No audit entries yet'}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[160px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-sm font-mono">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-txt-muted text-sm font-mono">{log.userId ?? 'system'}</TableCell>
                      <TableCell className="text-sm text-txt-secondary max-w-[240px] truncate">{log.details}</TableCell>
                      <TableCell className="text-sm text-txt-muted">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </NPageHeader>
  );
}
