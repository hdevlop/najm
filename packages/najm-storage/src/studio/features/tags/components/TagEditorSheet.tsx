import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTags } from '../hooks/useTags';
import { useFileTags } from '../hooks/useFileTags';
import { useTagApi, type TagInfo } from '../api';

interface Props {
  open: boolean;
  namespace: string;
  paths: string[];
  onClose: () => void;
  onSaved?: () => void;
}

export function TagEditorSheet({ open, namespace, paths, onClose, onSaved }: Props) {
  const { data: allTags = [], mutate: mutateTags } = useTags(open ? namespace : null);
  const isMulti = paths.length > 1;
  const singlePath = isMulti ? null : paths[0];

  const { tags: currentTags, setTags, isLoading: loadingCurrent } = useFileTags(namespace, open ? singlePath : null);
  const api = useTagApi();
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingMultiTags, setLoadingMultiTags] = useState(false);
  const [multiTags, setMultiTags] = useState<TagInfo[]>([]);
  const [selectedAdd, setSelectedAdd] = useState<string[]>([]);
  const [selectedRemove, setSelectedRemove] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue('');
      setSelectedAdd([]);
      setSelectedRemove([]);
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !isMulti) {
      setMultiTags([]);
      setLoadingMultiTags(false);
      return;
    }

    (async () => {
      setLoadingMultiTags(true);
      try {
        const results = await Promise.all(paths.map((path) => api.getFileTags(namespace, path)));
        if (cancelled) return;
        const byName = new Map<string, TagInfo>();
        for (const tags of results) {
          for (const tag of tags) {
            byName.set(tag.name, tag);
          }
        }
        setMultiTags(Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message ?? 'Failed to load tags');
      } finally {
        if (!cancelled) setLoadingMultiTags(false);
      }
    })();

    return () => { cancelled = true; };
  }, [api, isMulti, namespace, open, paths]);

  const visibleTags = useMemo(() => {
    const source = isMulti ? multiTags : currentTags;
    const byName = new Map<string, TagInfo>();
    for (const tag of source) {
      if (!selectedRemove.includes(tag.name)) byName.set(tag.name, tag);
    }
    for (const name of selectedAdd) {
      if (!byName.has(name)) {
        byName.set(name, { id: `pending:${name}`, namespace, name, color: null });
      }
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentTags, isMulti, multiTags, namespace, selectedAdd, selectedRemove]);

  const suggestions = useMemo(() => {
    const existing = new Set(visibleTags.map((t) => t.name));
    return allTags.filter((t) => !existing.has(t.name));
  }, [allTags, visibleTags]);

  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return suggestions.slice(0, 10);
    const lower = inputValue.toLowerCase();
    return suggestions.filter((t) => t.name.includes(lower)).slice(0, 10);
  }, [suggestions, inputValue]);

  const exactMatch = useMemo(() => {
    if (!inputValue.trim()) return false;
    return allTags.some((t) => t.name === inputValue.toLowerCase().trim());
  }, [allTags, inputValue]);

  const handleAddTag = useCallback(async (name: string) => {
    const trimmed = name.toLowerCase().trim();
    if (!trimmed) return;

    if (isMulti) {
      setSelectedAdd((prev) => prev.includes(trimmed) ? prev : [...prev, trimmed]);
      setSelectedRemove((prev) => prev.filter((n) => n !== trimmed));
    } else {
      const newTagNames = [...visibleTags.map((t) => t.name), trimmed];
      try {
        setSaving(true);
        await setTags(newTagNames);
        onSaved?.();
      } catch (e: any) {
        toast.error(e?.message ?? 'Failed to add tag');
      } finally {
        setSaving(false);
      }
    }
    setInputValue('');
  }, [isMulti, visibleTags, setTags, onSaved]);

  const handleRemoveTag = useCallback(async (name: string) => {
    if (isMulti) {
      setSelectedRemove((prev) => prev.includes(name) ? prev : [...prev, name]);
      setSelectedAdd((prev) => prev.filter((n) => n !== name));
    } else {
      const newTagNames = visibleTags.map((t) => t.name).filter((n) => n !== name);
      try {
        setSaving(true);
        await setTags(newTagNames);
        onSaved?.();
      } catch (e: any) {
        toast.error(e?.message ?? 'Failed to remove tag');
      } finally {
        setSaving(false);
      }
    }
  }, [isMulti, visibleTags, setTags, onSaved]);

  const handleCreateAndAdd = useCallback(async () => {
    const name = inputValue.toLowerCase().trim();
    if (!name) return;
    try {
      await api.createTag(namespace, name);
      await mutateTags();
      await handleAddTag(name);
      setInputValue('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create tag');
    }
  }, [api, namespace, mutateTags, handleAddTag, inputValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.toLowerCase().trim();
      if (!trimmed) return;
      if (exactMatch) {
        handleAddTag(trimmed);
      } else {
        handleCreateAndAdd();
      }
    }
  }, [inputValue, exactMatch, handleAddTag, handleCreateAndAdd]);

  const handleSaveMulti = useCallback(async () => {
    try {
      setSaving(true);
      await api.patchFileTags(namespace, paths, selectedAdd.length ? selectedAdd : undefined, selectedRemove.length ? selectedRemove : undefined);
      toast.success(`Tags updated for ${paths.length} files`);
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update tags');
    } finally {
      setSaving(false);
    }
  }, [api, namespace, paths, selectedAdd, selectedRemove, onSaved, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[420px] max-h-[80vh] overflow-auto rounded-xl border border-white/10 bg-bg-elev-2 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold text-txt">
            {isMulti ? `Edit Tags (${paths.length} files)` : 'Edit Tags'}
          </div>
          <button onClick={onClose} className="text-txt-muted hover:text-txt" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {(!isMulti && loadingCurrent) || (isMulti && loadingMultiTags) ? (
          <div className="flex items-center justify-center py-8 text-txt-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {visibleTags.map((tag) => {
                const isRemoving = selectedRemove.includes(tag.name);
                const isAdding = selectedAdd.includes(tag.name);
                return (
                  <span
                    key={tag.id}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      isRemoving
                        ? 'bg-red-500/15 text-red-400 line-through'
                        : isAdding
                        ? 'bg-brand/15 text-brand'
                        : 'bg-white/10 text-txt'
                    }`}
                  >
                    {tag.color && (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.name)}
                      className="ml-0.5 text-txt-muted hover:text-red-400"
                      aria-label={`Remove ${tag.name}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
              {visibleTags.length === 0 && (
                <span className="text-xs text-txt-muted">
                  {isMulti ? 'No tags assigned to the selected files' : 'No tags assigned'}
                </span>
              )}
            </div>

            <div className="relative mb-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add or create a tag..."
                className="w-full rounded-lg border border-white/10 bg-bg-elev-1 px-3 py-2 text-sm text-txt placeholder:text-txt-muted focus:border-brand focus:outline-none"
              />
              {inputValue.trim() && !exactMatch && (
                <button
                  onClick={handleCreateAndAdd}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand hover:bg-brand/25"
                >
                  <Plus size={12} className="inline" /> Create
                </button>
              )}
              {filteredSuggestions.length > 0 && inputValue.trim() && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-32 overflow-auto rounded-lg border border-white/10 bg-bg-elev-1 py-1 shadow-lg">
                  {filteredSuggestions.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag.name)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-txt hover:bg-white/5"
                    >
                      {tag.color && (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      {tag.name}
                      {tag.count !== undefined && (
                        <span className="ml-auto text-txt-muted">({tag.count})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isMulti && (
              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg px-3 py-1.5 text-xs text-txt-muted hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMulti}
                  disabled={saving || (!selectedAdd.length && !selectedRemove.length)}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Apply'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
