import React, { useEffect, useState } from 'react';
import { Tag, Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useToast } from '@/lib/toast';
import type { Label } from '@/features/labels/types';
import { NewLabelModal } from './NewLabelModal';
import { NPageHeader, NEmptyState, Button, Input, NativeSelect } from 'najm-ui';

interface LabelsViewProps {
  jid?: string | null;
}

function getContrastColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function LabelsView({ jid }: LabelsViewProps) {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState('');
  const [mutating, setMutating] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function fetchLabels() {
    if (!instanceId) return;
    setLoading(true);
    try {
      const data = await api.get(`/labels/${instanceId}`);
      setLabels(data || []);
    } catch (err: any) {
      toast.error('Failed to load labels: ' + (err?.message || 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLabels();
  }, [api, instanceId]);

  async function deleteLabel(labelId: string) {
    if (!instanceId) return;
    if (!confirm('Delete this label?')) return;
    try {
      await api.del(`/labels/${instanceId}/${labelId}`);
      toast.success('Label deleted');
      await fetchLabels();
    } catch (err: any) {
      toast.error('Delete failed: ' + (err?.message || 'unknown'));
    }
  }

  async function renameLabel(labelId: string) {
    if (!instanceId || !editName.trim()) return;
    try {
      await api.patch(`/labels/${instanceId}/${labelId}`, { name: editName.trim() });
      toast.success('Label renamed');
      setEditingId(null);
      await fetchLabels();
    } catch (err: any) {
      toast.error('Rename failed: ' + (err?.message || 'unknown'));
    }
  }

  async function assign(labelId: string) {
    if (!instanceId || !jid || !labelId) return;
    setMutating(true);
    try {
      await api.post(`/labels/${instanceId}/${jid}`, { labelId });
      toast.success('Label assigned');
    } catch (err: any) {
      toast.error('Failed: ' + (err?.message || 'unknown'));
    } finally {
      setMutating(false);
    }
  }

  async function remove(labelId: string) {
    if (!instanceId || !jid || !labelId) return;
    setMutating(true);
    try {
      await api.post(`/labels/${instanceId}/${jid}/remove`, { labelId });
      toast.success('Label removed');
    } catch (err: any) {
      toast.error('Failed: ' + (err?.message || 'unknown'));
    } finally {
      setMutating(false);
    }
  }

  const sortedLabels = [...labels].sort((a, b) => {
    const countA = a.count ?? 0;
    const countB = b.count ?? 0;
    if (countA !== countB) return countB - countA;
    return a.name.localeCompare(b.name);
  });

  if (!instanceId) {
    return (
      <NEmptyState
        icon={Tag}
        title="No instance selected"
        description="Select an instance to manage labels."
      />
    );
  }

  return (
    <NPageHeader
      icon={Tag}
      title="Labels"
      subtitle="Organize conversations with labels"
      actions={
        <Button variant="outline" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New label
        </Button>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        {labels.length === 0 && !loading && (
          <NEmptyState
            icon={Tag}
            title="No labels yet"
            description="Create your first label above. Labels like Lead, Customer, or Follow-up help you filter conversations."
          />
        )}

        <div className="flex flex-wrap gap-2">
          {sortedLabels.map((label) => {
            const isEditing = editingId === label.id;
            const bg = label.color ? `${label.color}25` : 'rgba(16,185,129,0.15)';
            const fg = label.color ? getContrastColor(label.color) : '#34d399';
            const count = label.count ?? 0;

            if (isEditing) {
              return (
                <div
                  key={label.id}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5"
                >
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-6 w-32 border-0 bg-transparent px-1 py-0 text-xs"
                    autoFocus
                  />
                  <button
                    onClick={() => renameLabel(label.id)}
                    className="text-status-green hover:text-status-green/80"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-txt-muted hover:text-txt-primary"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={label.id}
                className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: bg,
                  color: fg,
                }}
              >
                <Tag size={12} />
                <span>{label.name}</span>
                {count > 0 && (
                  <span className="ml-0.5 rounded-full bg-black/10 px-1.5 py-0 text-[10px]">
                    {count}
                  </span>
                )}
                <button
                  onClick={() => { setEditingId(label.id); setEditName(label.name); }}
                  className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Rename label ${label.name}`}
                >
                  <Pencil size={10} />
                </button>
                <button
                  onClick={() => deleteLabel(label.id)}
                  aria-label={`Delete label ${label.name}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </div>

        {jid && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <span className="text-xs text-txt-secondary">Manage labels for <span className="font-mono text-txt-primary">{jid}</span></span>
            <div className="flex items-center gap-2">
              <NativeSelect
                value={selectedLabelId}
                onChange={(e) => setSelectedLabelId(e.target.value)}
                placeholder="Select label"
                options={labels.map((l) => ({ value: l.id, label: l.name }))}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => assign(selectedLabelId)}
                disabled={mutating || !selectedLabelId}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Assign
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => remove(selectedLabelId)}
                disabled={mutating || !selectedLabelId}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <NewLabelModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchLabels}
        />
      )}
    </NPageHeader>
  );
}
