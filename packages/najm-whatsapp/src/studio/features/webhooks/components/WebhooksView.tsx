import React, { useEffect, useState } from 'react';
import { Send, RefreshCw, Plus, Pencil, Trash2, Webhook as WebhookIcon } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { WebhookFormModal } from './WebhookFormModal';
import type { Webhook } from '@/features/webhooks/types';
import { NPageHeader, NEmptyState, Button } from 'najm-kit';

export function WebhooksView() {
  const api = useApiClient();
  const toast = useToast();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchWebhooks() {
    setLoading(true);
    try {
      const data = await api.get('/webhooks');
      setWebhooks(data || []);
    } catch (err: any) {
      toast.error('Failed to load webhooks: ' + (err?.message || 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWebhooks();
  }, [api]);

  async function testWebhook(wh: Webhook) {
    setTestingId(wh.id);
    try {
      await api.post('/webhooks/test', { url: wh.url, eventType: wh.events?.[0] || 'message' });
      toast.success('Test sent successfully');
    } catch (err: any) {
      toast.error('Test failed: ' + (err?.message || 'unknown'));
    } finally {
      setTestingId(null);
    }
  }

  async function deleteWebhook(wh: Webhook) {
    if (!confirm(`Delete webhook for ${wh.url}?`)) return;
    try {
      await api.del(`/webhooks/${wh.id}`);
      toast.success('Webhook deleted');
      await fetchWebhooks();
    } catch (err: any) {
      toast.error('Delete failed: ' + (err?.message || 'unknown'));
    }
  }

  return (
    <NPageHeader
      icon={WebhookIcon}
      title="Webhooks"
      subtitle="Manage event callbacks"
      actions={
        <div className="flex items-center gap-2">
          <Button  variant="outline" onClick={fetchWebhooks} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button  onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        {webhooks.length === 0 && !loading && (
          <NEmptyState
            icon={WebhookIcon}
            title="No webhooks"
            description="Create a webhook to receive event notifications."
            action={
              <Button  onClick={() => setShowCreate(true)}>
                Create Webhook
              </Button>
            }
          />
        )}

        <div className="flex flex-col gap-2">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-subtle"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-txt-primary">{wh.url}</span>
                  {wh.enabled === false && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-txt-muted">
                      disabled
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(wh.events || []).map((ev) => (
                    <span
                      key={ev}
                      className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-txt-secondary"
                    >
                      {ev}
                    </span>
                  ))}
                  {(!wh.events || wh.events.length === 0) && (
                    <span className="text-[10px] text-txt-muted">all events</span>
                  )}
                </div>
                {wh.headers && Object.keys(wh.headers).length > 0 && (
                  <span className="text-[10px] text-txt-muted">
                    {Object.keys(wh.headers).length} header(s)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testWebhook(wh)}
                  disabled={testingId === wh.id}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {testingId === wh.id ? 'Testing...' : 'Test'}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(wh)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteWebhook(wh)}
                  className="text-status-red/70 hover:text-status-red"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <WebhookFormModal onClose={() => setShowCreate(false)} onSaved={fetchWebhooks} />
      )}

      {editing && (
        <WebhookFormModal initial={editing} onClose={() => setEditing(null)} onSaved={fetchWebhooks} />
      )}
    </NPageHeader>
  );
}
