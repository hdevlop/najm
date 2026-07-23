import React, { useState, useMemo } from 'react';
import { Tag, Trash2, Pencil, Plus, X, Palette } from 'lucide-react';
import { NEmptyState, NTable, Button, NConfirmDialog, NPageHeader } from 'najm-kit';
import { useTags } from '../hooks/useTags';
import { useTagCapabilities } from '../hooks/useTagCapabilities';
import { useTagApi, type TagInfo } from '../api';
import { useBuckets } from '../../dashboard/hooks/useBuckets';
import { toast } from 'sonner';

export function TagsView() {
  const { data: bucketsData } = useBuckets();
  const buckets = useMemo(() => (bucketsData ?? []).map((b: any) => b.name as string), [bucketsData]);
  const [selectedBucket, setSelectedBucket] = useState<string>(buckets[0] ?? '');
  const currentBucket = selectedBucket || buckets[0] || '';
  const { data: capabilities } = useTagCapabilities();

  const tagsEnabled = capabilities?.tags ?? false;
  const { data: tags, mutate } = useTags(currentBucket || null, tagsEnabled);
  const api = useTagApi();

  const [editingTag, setEditingTag] = useState<TagInfo | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TagInfo | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !currentBucket) return;
    try {
      setSaving(true);
      await api.createTag(currentBucket, trimmed, newColor || undefined);
      await mutate();
      setNewName('');
      setNewColor('');
      setCreating(false);
      toast.success(`Tag "${trimmed}" created`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create tag');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTag || !currentBucket) return;
    try {
      setSaving(true);
      await api.updateTag(currentBucket, editingTag.id, {
        name: editName.trim() || undefined,
        color: editColor || null,
      });
      await mutate();
      setEditingTag(null);
      toast.success('Tag updated');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !currentBucket) return;
    try {
      await api.deleteTag(currentBucket, deleteTarget.id);
      await mutate();
      toast.success('Tag deleted');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete tag');
    } finally {
      setDeleteTarget(null);
    }
  };

  const startEdit = (tag: TagInfo) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color ?? '');
  };

  const columns = useMemo<any[]>(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }: any) => {
        const tag = row.original as TagInfo;
        return (
          <div className="flex items-center gap-2">
            {tag.color && (
              <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
            )}
            <span className="font-medium text-txt">{tag.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'count',
      header: 'Files',
      cell: ({ row }: any) => {
        const tag = row.original as TagInfo;
        return <span className="text-txt-muted">{tag.count ?? 0}</span>;
      },
    },
    {
      accessorKey: 'color',
      header: 'Color',
      cell: ({ row }: any) => {
        const tag = row.original as TagInfo;
        if (!tag.color) return <span className="text-txt-muted">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
            <span className="text-txt-muted text-xs">{tag.color}</span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }: any) => {
        const tag = row.original as TagInfo;
        return (
          <div className="flex justify-end gap-1.5">
            <Button variant="outline" size="sm" onClick={() => startEdit(tag)} className="gap-1">
              <Pencil size={12} />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(tag)} className="gap-1">
              <Trash2 size={12} />
            </Button>
          </div>
        );
      },
    },
  ], []);

  return (
    <NPageHeader
      icon={Tag}
      title="Tags"
      subtitle="Organize files with custom labels"
      filters={
        buckets.length > 0 ? (
          <select
            value={currentBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            className="rounded-md border border-white/10 bg-bg-elev-2 px-2 py-1 text-xs text-txt focus:border-brand focus:outline-none"
          >
            {buckets.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        ) : undefined
      }
      actions={
        <Button variant="outline" size="sm" onClick={() => setCreating(true)} disabled={!tagsEnabled} className="gap-1">
          <Plus size={12} />
          New Tag
        </Button>
      }
    >
      <div className="p-4">
        {!tagsEnabled ? (
          <NEmptyState
            icon={Tag}
            title="Tags are unavailable"
            description="Use a database storage provider with tag tables to organize files with tags."
          />
        ) : currentBucket ? (
          <NTable<TagInfo, 'table'>
            data={tags ?? []}
            columns={columns}
            loading={!tags}
            getRowId={(tag) => tag.id}
            className="px-0 py-0"
            headerClassName="bg-bg-elev-2"
            classNames={{
              content: 'border-white/15 bg-bg-elev-1 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
              tableHeader: '[&_tr]:border-white/15',
              pagination: 'border-t border-white/10 pt-3 text-txt-muted',
              row: 'border-white/10 hover:bg-white/[0.03]',
            }}
            availableModes={['table']}
            mode="table"
            showCheckbox={false}
            showViewToggle={false}
            loadingText="Loading tags..."
            renderEmpty={() => (
              <NEmptyState
                icon={Tag}
                title="No tags yet"
                description="Create tags to organize your files. Tags can be assigned from the file explorer."
              />
            )}
          />
        ) : (
          <NEmptyState
            icon={Tag}
            title="No buckets available"
            description="Tags are managed per bucket. Create a bucket first."
          />
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setCreating(false); setNewName(''); setNewColor(''); }}>
          <div className="w-[380px] rounded-xl border border-white/10 bg-bg-elev-2 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-bold text-txt">Create Tag</div>
              <button onClick={() => { setCreating(false); setNewName(''); setNewColor(''); }} className="text-txt-muted hover:text-txt" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tag name"
                className="w-full rounded-lg border border-white/10 bg-bg-elev-1 px-3 py-2 text-sm text-txt placeholder:text-txt-muted focus:border-brand focus:outline-none"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              />
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-txt-muted shrink-0" />
                {newColor ? (
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
                  />
                ) : (
                  <button
                    onClick={() => setNewColor('#6366f1')}
                    className="h-8 w-8 rounded border border-dashed border-white/20 text-[10px] text-txt-muted hover:border-white/40 hover:text-txt"
                  >
                    +
                  </button>
                )}
                <span className="text-xs text-txt-muted">{newColor || 'No color'}</span>
                {newColor && (
                  <button onClick={() => setNewColor('')} className="text-xs text-txt-muted hover:text-txt">Clear</button>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setCreating(false); setNewName(''); setNewColor(''); }} className="rounded-lg px-3 py-1.5 text-xs text-txt-muted hover:bg-white/5">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !newName.trim()}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingTag(null)}>
          <div className="w-[380px] rounded-xl border border-white/10 bg-bg-elev-2 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-bold text-txt">Edit Tag</div>
              <button onClick={() => setEditingTag(null)} className="text-txt-muted hover:text-txt" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Tag name"
                className="w-full rounded-lg border border-white/10 bg-bg-elev-1 px-3 py-2 text-sm text-txt placeholder:text-txt-muted focus:border-brand focus:outline-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-txt-muted shrink-0" />
                {editColor ? (
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-white/10 bg-transparent"
                  />
                ) : (
                  <button
                    onClick={() => setEditColor('#6366f1')}
                    className="h-8 w-8 rounded border border-dashed border-white/20 text-[10px] text-txt-muted hover:border-white/40 hover:text-txt"
                  >
                    +
                  </button>
                )}
                <span className="text-xs text-txt-muted">{editColor || 'No color'}</span>
                {editColor && (
                  <button onClick={() => setEditColor('')} className="text-xs text-txt-muted hover:text-txt">Clear</button>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditingTag(null)} className="rounded-lg px-3 py-1.5 text-xs text-txt-muted hover:bg-white/5">
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={saving || !editName.trim()}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleDelete}
        title={`Delete tag "${deleteTarget?.name ?? ''}"?`}
        description="This will remove the tag from all files. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </NPageHeader>
  );
}
