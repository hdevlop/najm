import React, { useState } from 'react';
import { Database, Plus, Trash2, ArrowRight } from 'lucide-react';
import type { StudioConnection } from '@/lib/connectionsStore';

interface ConnectionsManagerProps {
  connections: StudioConnection[];
  onSelect: (id: string) => void;
  onAdd: (input: { name: string; apiBaseUrl: string }) => void;
  onRemove: (id: string) => void;
}

/**
 * Standalone home screen: the operator's list of target apps. Selecting one
 * enters the studio against that app's API. Persisted in localStorage.
 */
export function ConnectionsManager({ connections, onSelect, onAdd, onRemove }: ConnectionsManagerProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Enter the app API URL');
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl) && !trimmedUrl.startsWith('/')) {
      setError('URL should start with http(s):// or /');
      return;
    }
    setError(null);
    onAdd({ name: name.trim() || trimmedUrl, apiBaseUrl: trimmedUrl });
    setName('');
    setUrl('');
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-glow text-brand">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-txt-primary">RAG Studio — Connections</h1>
            <p className="text-sm text-txt-secondary">Pick an app to inspect, or add a new one.</p>
          </div>
        </div>

        {connections.length > 0 && (
          <ul className="mb-6 flex flex-col gap-2">
            {connections.map((c) => (
              <li
                key={c.id}
                className="group flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ArrowRight className="h-4 w-4 shrink-0 text-txt-muted group-hover:text-brand" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-txt-primary">{c.name}</span>
                    <span className="block truncate text-xs text-txt-secondary">{c.apiBaseUrl}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
                  aria-label={`Remove ${c.name}`}
                  className="ml-2 rounded-md p-1.5 text-txt-muted opacity-0 transition hover:bg-card-hover hover:text-status-red group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-border-subtle pt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-txt-muted">Add an app</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. CRM — prod)"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-txt-primary outline-none focus:border-brand"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="API URL (e.g. https://crm.example.com/api)"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-txt-primary outline-none focus:border-brand"
          />
          {error && <p className="text-xs text-status-red">{error}</p>}
          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" />
            Add connection
          </button>
        </form>
      </div>
    </div>
  );
}
