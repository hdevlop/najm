import React, { useState } from 'react';
import { Copy, X, AlertTriangle } from 'lucide-react';
import { useApiClient } from '../../../lib/api';
import type { PresignModalProps } from '../types';

export function PresignModal({
  file,
  onClose,
}: {
  file: { namespace: string; filePath: string };
  onClose: () => void;
}) {
  const api = useApiClient();
  const [ttl, setTtl] = useState(300);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError('');
    setUrl('');
    try {
      const res = await api.post<{ url: string }>(`/${file.namespace}/files/presign`, {
        path: file.filePath,
        method: 'GET',
        ttlSeconds: ttl,
      });
      setUrl(res.url);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 rounded-xl border border-white/10 bg-bg-elev-2 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold text-txt">Share File</div>
          <button onClick={onClose} className="text-txt-muted hover:text-txt" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-muted">
            TTL (seconds)
          </label>
          <input
            type="range"
            min={60}
            max={86400}
            step={60}
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <div className="text-xs text-txt-muted">{Math.floor(ttl / 60)} minutes</div>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate URL'}
        </button>

        {url && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg-elev-1 p-2">
            <code className="flex-1 truncate text-[10px] text-txt-muted">{url}</code>
            <button
              onClick={() => navigator.clipboard.writeText(url)}
              className="text-txt-muted hover:text-txt"
              aria-label="Copy URL"
            >
              <Copy size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
