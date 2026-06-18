import React, { useState, useEffect } from 'react';
import { Save, SlidersHorizontal, BookOpen } from 'lucide-react';
import { Button } from 'najm-kit';
import { Slider } from 'najm-kit';
import { NativeSelect as Select } from 'najm-kit';
import { Switch } from 'najm-kit';
import { NAlert } from 'najm-kit';
import type { LiveRoutingSettings } from '@/features/logs/types';

interface SettingsViewProps {
  settings: LiveRoutingSettings;
  onSave: (settings: Partial<LiveRoutingSettings>) => void;
  saving: boolean;
  embedded?: boolean;
}

const FALLBACK_OPTIONS = [
  { value: 'all', label: 'Send all tools' },
  { value: 'none', label: 'Send no tools' },
];

function SectionTitle({
  colorClass,
  children,
}: {
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-1 rounded-full ${colorClass}`} />
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-txt-secondary">
        {children}
      </h3>
    </div>
  );
}

export function SettingsView({ settings, onSave, saving, embedded }: SettingsViewProps) {
  const [local, setLocal] = useState<LiveRoutingSettings>(settings);

  useEffect(() => setLocal(settings), [settings]);

  const handleSave = () => {
    onSave(local);
  };

  const update = <K extends keyof LiveRoutingSettings>(key: K, value: LiveRoutingSettings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleKnowledgeToggle = (checked: boolean) => {
    update('enableKnowledge', checked);
    onSave({ enableKnowledge: checked });
  };

  const content = (
    <>
      <div className="rounded-lg border border-border bg-card/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-brand/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-brand" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-txt-primary">Knowledge Base (RAG)</h3>
                <p className="text-xs text-txt-muted">Document retrieval and citations</p>
              </div>
            </div>
            <Switch
              checked={local.enableKnowledge}
              onCheckedChange={handleKnowledgeToggle}
              disabled={saving}
              className="data-[state=checked]:bg-brand data-[state=unchecked]:bg-surface"
            />
          </div>
        </div>

        {/* Thresholds Card */}
        <div className="rounded-lg border border-border bg-card/70 p-4 space-y-4">
          <SectionTitle colorClass="bg-brand">Thresholds</SectionTitle>

          <div className="space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm text-txt-secondary">Max tools</label>
                <span className="min-w-9 rounded-md bg-brand/10 px-2 py-0.5 text-center font-mono text-xs font-semibold text-brand">{local.maxTools}</span>
              </div>
              <Slider
                value={[local.maxTools]}
                onValueChange={([v]) => update('maxTools', v)}
                min={1}
                max={20}
                step={1}
              />
            </div>

            <div className="space-y-2.5 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-txt-secondary">Similarity threshold</label>
                <span className="min-w-11 rounded-md bg-brand/10 px-2 py-0.5 text-center font-mono text-xs font-semibold text-brand">{(local.similarityThreshold * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[local.similarityThreshold * 100]}
                onValueChange={([v]) => update('similarityThreshold', v / 100)}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-2.5 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-txt-secondary">Top semantic hits</label>
                <span className="min-w-9 rounded-md bg-brand/10 px-2 py-0.5 text-center font-mono text-xs font-semibold text-brand">{local.topSemanticHits}</span>
              </div>
              <Slider
                value={[local.topSemanticHits]}
                onValueChange={([v]) => update('topSemanticHits', v)}
                min={1}
                max={20}
                step={1}
              />
            </div>
          </div>
        </div>

        {/* Fallback Behavior Card */}
        <div className="rounded-lg border border-border bg-card/70 p-4 space-y-4">
          <SectionTitle colorClass="bg-status-yellow">Fallback Behavior</SectionTitle>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-txt-muted">No match</label>
              <Select
                options={FALLBACK_OPTIONS}
                value={local.fallbackOnNoMatch}
                onChange={(e) => update('fallbackOnNoMatch', e.target.value as 'all' | 'none')}
                className="h-10 border-border bg-bg text-txt-primary hover:border-brand/60 focus-visible:ring-brand focus-visible:ring-offset-bg"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-txt-muted">Router error</label>
              <Select
                options={FALLBACK_OPTIONS}
                value={local.fallbackOnRouterError}
                onChange={(e) => update('fallbackOnRouterError', e.target.value as 'all' | 'none')}
                className="h-10 border-border bg-bg text-txt-primary hover:border-brand/60 focus-visible:ring-brand focus-visible:ring-offset-bg"
              />
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <NAlert
          tone="warning"
          className="p-3"
          title="Changes apply immediately."
          description={<span className="text-xs">Use care when editing live routing thresholds.</span>}
        />
      </>
    );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-brand/10 flex items-center justify-center">
              <SlidersHorizontal className="h-4 w-4 text-brand" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-txt-primary">Live Routing</h2>
              <p className="truncate text-sm text-txt-muted">Tool selection and semantic matching</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-9 shrink-0 gap-1.5 bg-brand px-3 text-white hover:bg-brand-hover focus-visible:ring-brand"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border bg-sidebar/95">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-brand/10 flex items-center justify-center">
            <SlidersHorizontal className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-txt-primary">Live Routing</h2>
            <p className="truncate text-sm text-txt-muted">Tool selection and semantic matching</p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-9 shrink-0 gap-1.5 bg-brand px-3 text-white hover:bg-brand-hover focus-visible:ring-brand"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {content}
      </div>
    </div>
  );
}
