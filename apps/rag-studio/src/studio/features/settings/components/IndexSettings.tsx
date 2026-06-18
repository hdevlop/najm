import React from 'react';
import { RefreshCw, Database, Save } from 'lucide-react';
import { Badge } from 'najm-kit';
import { Button } from 'najm-kit';
import { Input } from 'najm-kit';
import { Separator } from 'najm-kit';
import { NPageHeader } from 'najm-kit';
import type { IndexSettings } from '@/features/logs/types';

interface IndexSettingsProps {
  settings: IndexSettings;
  onReindexAll?: () => Promise<void> | void;
  onSaveAllowedLangs?: (allowedLangs: string[]) => Promise<void> | void;
  saving?: boolean;
}

const formatLangs = (langs?: string[]) => (langs ?? []).join(', ');

const parseLangs = (raw: string) => [
  ...new Set(
    raw
      .split(',')
      .map((lang) => lang.trim().toLowerCase())
      .filter(Boolean),
  ),
];

export function IndexSettings({ settings, onReindexAll, onSaveAllowedLangs, saving = false }: IndexSettingsProps) {
  const [reindexing, setReindexing] = React.useState(false);
  const [allowedLangsText, setAllowedLangsText] = React.useState(formatLangs(settings.allowedLangs));

  React.useEffect(() => {
    setAllowedLangsText(formatLangs(settings.allowedLangs));
  }, [settings.allowedLangs]);

  const handleReindex = async () => {
    if (!onReindexAll) return;
    setReindexing(true);
    try {
      await onReindexAll();
    } finally {
      setReindexing(false);
    }
  };

  const handleSaveAllowedLangs = async () => {
    if (!onSaveAllowedLangs) return;
    await onSaveAllowedLangs(parseLangs(allowedLangsText));
  };

  const allowedLangsChanged = allowedLangsText.trim() !== formatLangs(settings.allowedLangs);

  return (
    <NPageHeader
      icon={Database}
      title="Index Settings"
      subtitle="Vector store and embedding configuration"
    >
      <div className="p-5 space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-brand" />
            <h3 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">Embedding Configuration</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-bg border border-border">
              <label className="text-sm font-medium text-txt-muted uppercase tracking-wider block mb-1.5">
                Provider
              </label>
              <Badge variant="outline" className="text-sm font-mono">{settings.embeddingProvider}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-bg border border-border">
              <label className="text-sm font-medium text-txt-muted uppercase tracking-wider block mb-1.5">
                Model
              </label>
              <Badge variant="outline" className="text-sm font-mono">{settings.embeddingModel}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-bg border border-border">
              <label className="text-sm font-medium text-txt-muted uppercase tracking-wider block mb-1.5">
                Dimensions
              </label>
              <Badge variant="outline" className="text-sm font-mono">{settings.embeddingDimensions}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-bg border border-border">
              <label className="text-sm font-medium text-txt-muted uppercase tracking-wider block mb-1.5">
                Vector Store
              </label>
              <Badge variant="outline" className="text-sm font-mono">{settings.vectorStoreDriver}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-bg border border-border sm:col-span-2">
              <label className="text-sm font-medium text-txt-muted uppercase tracking-wider block mb-1.5">
                Database Dialect
              </label>
              <Badge variant="outline" className="text-sm font-mono">{settings.dialect}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-bg border border-border sm:col-span-2">
              <label className="text-sm font-medium text-txt-muted uppercase tracking-wider block mb-1.5">
                Allowed Languages (semantics)
              </label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={allowedLangsText}
                    onChange={(event) => setAllowedLangsText(event.target.value)}
                    placeholder="en, fr, ar, darija"
                    className="h-9 bg-card font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveAllowedLangs}
                    disabled={!onSaveAllowedLangs || saving || !allowedLangsChanged}
                    className="h-9 shrink-0 gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
                {settings.allowedLangs && settings.allowedLangs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {settings.allowedLangs.map((l) => (
                      <Badge key={l} variant="outline" className="text-sm font-mono uppercase">{l}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-txt-muted">All languages allowed</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-brand/10 flex items-center justify-center">
              <RefreshCw className="h-4 w-4 text-brand" />
            </div>
            <div>
              <p className="text-sm font-medium text-txt-primary">Reindex All</p>
              <p className="text-sm text-txt-muted mt-0.5">Re-index all registered MCP tools</p>
            </div>
          </div>
          <Button  variant="outline" onClick={handleReindex} disabled={!onReindexAll || reindexing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${reindexing ? 'animate-spin' : ''}`} />
            {reindexing ? 'Indexing...' : 'Run'}
          </Button>
        </div>
      </div>
    </NPageHeader>
  );
}
