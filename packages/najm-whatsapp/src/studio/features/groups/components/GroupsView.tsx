import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, RefreshCw, FolderKanban } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { GroupList } from './GroupList';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupDetailModal } from './GroupDetailModal';
import type { Group } from '@/features/groups/types';
import { NPageHeader, NEmptyState, Button, Input } from 'najm-kit';

export function GroupsView() {
  const api = useApiClient();
  const { instanceId } = useSelectedInstance();
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailJid, setDetailJid] = useState<string | null>(null);

  async function fetchGroups() {
    if (!instanceId) return;
    setLoading(true);
    try {
      const data = await api.get(`/groups/${instanceId}`);
      setGroups(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGroups();
  }, [api, instanceId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups.filter(
      (g) => g.subject.toLowerCase().includes(q) || g.jid.toLowerCase().includes(q)
    );
  }, [groups, query]);

  if (!instanceId) {
    return (
      <NEmptyState
        icon={FolderKanban}
        title="No instance selected"
        description="Select an instance to view groups."
      />
    );
  }

  return (
    <NPageHeader
      icon={FolderKanban}
      title="Groups"
      subtitle="Manage your WhatsApp groups"
      actions={
        <div className="flex items-center gap-2">
          <Button  variant="outline" onClick={fetchGroups} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button  onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Create
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-3 p-5">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groups..."
            className="pl-9"
          />
        </div>

        {groups.length === 0 && !loading && (
          <NEmptyState
            icon={FolderKanban}
            title="No groups"
            description="Create your first group to get started."
          />
        )}

        <div className="flex-1 overflow-hidden">
          <GroupList groups={filtered} onSelect={(jid) => setDetailJid(jid)} />
        </div>
      </div>

      {showCreate && (
        <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={fetchGroups} />
      )}

      {detailJid && instanceId && (
        <GroupDetailModal instanceId={instanceId} jid={detailJid} onClose={() => setDetailJid(null)} />
      )}
    </NPageHeader>
  );
}
