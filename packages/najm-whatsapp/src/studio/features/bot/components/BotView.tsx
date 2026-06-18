import React, { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, Pencil, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useToast } from '@/lib/toast';
import { AddRuleModal } from './AddRuleModal';
import type { AutoReplyRule, AiConfig, MatchType } from '../types';
import { NPageHeader, NEmptyState, Button, Input, Textarea, Switch, NativeSelect, Slider, NForm } from 'najm-kit';

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  exact: 'EXACT',
  prefix: 'PREFIX',
  regex: 'REGEX',
};

const AI_MODELS = [
  'gpt-4',
  'gpt-4o-mini',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
];

function parseTemp(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0.7 : n;
  }
  return 0.7;
}

export function BotView() {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [savingAi, setSavingAi] = useState(false);
  const [showAiSection, setShowAiSection] = useState(true);

  // AI form state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTemp, setAiTemp] = useState(0.7);

  async function fetchData() {
    if (!instanceId) return;
    setLoading(true);
    try {
      const [rulesData, aiData] = await Promise.all([
        api.get(`/auto-reply/${instanceId}`).catch(() => []),
        api.get(`/ai-config/${instanceId}`).catch(() => null),
      ]);
      setRules(rulesData || []);
      if (aiData) {
        setAiConfig(aiData);
        setAiEnabled(aiData.enabled ?? false);
        setAiModel(aiData.model || 'gpt-4o-mini');
        setAiPrompt(aiData.systemPrompt || '');
        setAiTemp(parseTemp(aiData.temperature));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [api, instanceId]);

  async function toggleRule(rule: AutoReplyRule) {
    if (!instanceId) return;
    try {
      await api.patch(`/auto-reply/${instanceId}/${rule.id}`, { enabled: !rule.enabled });
      await fetchData();
    } catch (err: any) {
      toast.error('Update failed: ' + (err?.message || 'unknown'));
    }
  }

  async function deleteRule(ruleId: string) {
    if (!instanceId) return;
    if (!confirm('Delete this rule?')) return;
    try {
      await api.del(`/auto-reply/${instanceId}/${ruleId}`);
      toast.success('Rule deleted');
      await fetchData();
    } catch (err: any) {
      toast.error('Delete failed: ' + (err?.message || 'unknown'));
    }
  }

  async function saveAiConfig() {
    if (!instanceId) return;
    setSavingAi(true);
    try {
      await api.post(`/ai-config/${instanceId}`, {
        enabled: aiEnabled,
        provider: aiModel.startsWith('gpt') ? 'openai' : 'anthropic',
        model: aiModel,
        systemPrompt: aiPrompt,
        temperature: aiTemp,
      });
      toast.success('AI settings saved');
      await fetchData();
    } catch (err: any) {
      toast.error('Save failed: ' + (err?.message || 'unknown'));
    } finally {
      setSavingAi(false);
    }
  }

  const aiDirty =
    aiEnabled !== (aiConfig?.enabled ?? false) ||
    aiModel !== (aiConfig?.model || 'gpt-4o-mini') ||
    aiPrompt !== (aiConfig?.systemPrompt || '') ||
    aiTemp !== parseTemp(aiConfig?.temperature);

  if (!instanceId) {
    return (
      <NEmptyState
        icon={Bot}
        title="No instance selected"
        description="Select an instance to configure bot settings."
      />
    );
  }

  return (
    <NPageHeader
      icon={Bot}
      title="Bot"
      subtitle="Configure auto-replies and AI responses"
      actions={
        <Button onClick={() => { setEditingRule(null); setShowModal(true); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </Button>
      }
    >
      <div className="flex flex-col gap-6 p-5">
        {/* Rules List */}
        {rules.length === 0 && !loading && (
          <NEmptyState
            icon={Bot}
            title="No auto-reply rules"
            description="Add a rule to respond automatically to incoming messages."
          />
        )}

        <div className="flex flex-col gap-2">
          {rules.map((rule) => {
            const isExpanded = expandedRuleId === rule.id;
            return (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-border-subtle"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => toggleRule(rule)}
                  />

                  {/* Pattern pill */}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate rounded bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                      {rule.pattern}
                    </span>
                    {rule.matchType !== 'exact' && (
                      <span className="rounded bg-surface px-1.5 py-0 text-[10px] font-medium uppercase text-txt-muted">
                        {MATCH_TYPE_LABELS[rule.matchType]}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setShowModal(true);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-txt-muted hover:bg-surface hover:text-txt-primary"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-status-red hover:bg-status-red/10"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-txt-muted hover:bg-surface"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Response preview */}
                {isExpanded ? (
                  <div className="ml-12 rounded-lg bg-surface/50 p-2.5 text-xs text-txt-secondary">
                    <pre className="whitespace-pre-wrap font-mono">{rule.response}</pre>
                  </div>
                ) : (
                  <p className="ml-12 truncate text-xs text-txt-muted">
                    {rule.response}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Integration */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-txt-primary">AI Integration</h3>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
              />
              <button
                onClick={() => setShowAiSection((s) => !s)}
                className="text-txt-muted hover:text-txt-primary"
              >
                {showAiSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {showAiSection && (
            <NForm onSubmit={saveAiConfig} className="flex flex-col gap-4">
              <p className="text-xs text-txt-muted">
                Use AI to generate responses for unmatched messages.
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">Model</label>
                <NativeSelect
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  disabled={!aiEnabled}
                  options={AI_MODELS.map((m) => ({ value: m, label: m }))}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">System Prompt</label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                  rows={4}
                  disabled={!aiEnabled}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">Temperature</label>
                  <span className="text-xs font-semibold text-brand">{aiTemp}</span>
                </div>
                <Slider
                  value={[aiTemp]}
                  onValueChange={([v]) => setAiTemp(v)}
                  min={0}
                  max={1}
                  step={0.1}
                  disabled={!aiEnabled}
                />
                <div className="flex justify-between text-[10px] text-txt-muted">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              <Button type="submit" disabled={savingAi || !aiDirty} className="w-full">
                {savingAi ? 'Saving…' : 'Save AI Settings'}
              </Button>
            </NForm>
          )}
        </div>
      </div>

      {showModal && (
        <AddRuleModal
          initial={editingRule}
          onClose={() => { setShowModal(false); setEditingRule(null); }}
          onSaved={fetchData}
        />
      )}
    </NPageHeader>
  );
}
