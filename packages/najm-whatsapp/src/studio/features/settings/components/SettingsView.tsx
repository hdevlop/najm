import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Settings,
  Activity,
  MessageSquare,
  Image,
  Bot,
  Gauge,
  Power,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wifi,
} from 'lucide-react';
import { NPageHeader, NEmptyState, Button, Input, Switch, Slider, Dialog, DialogContent, DialogHeader, DialogTitle } from 'najm-ui';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useActiveView } from '@/shared/hooks/useActiveView';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { StudioSettings } from '@/features/settings/types';
import type { Instance } from '@/features/instances/types';

export function SettingsView() {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmName, setResetConfirmName] = useState('');
  const [resetting, setResetting] = useState(false);

  // Local UI state for toggles/sliders (backend wiring TBD)
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [onlinePresence, setOnlinePresence] = useState(true);
  const [autoDownload, setAutoDownload] = useState(true);
  const [maxFileSize, setMaxFileSize] = useState(50);
  const [messagesPerMinute, setMessagesPerMinute] = useState(50);
  const [messageDelay, setMessageDelay] = useState(200);

  async function fetchSettings() {
    setLoading(true);
    try {
      const [data, instData] = await Promise.all([
        api.get('/settings'),
        api.get('/instances').catch(() => []),
      ]);
      setSettings(data || null);
      setInstances(instData || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, [api, instanceId]);

  async function handleTestConnection() {
    if (!instanceId) {
      toast.error('Select an instance first');
      return;
    }
    setTesting(true);
    try {
      await api.post(`/instances/${instanceId}/connect`);
      toast.success('Connection test initiated');
    } catch (err: any) {
      toast.error('Test failed: ' + (err?.message || 'unknown'));
    } finally {
      setTesting(false);
    }
  }

  function handleCopyPath(path: string) {
    navigator.clipboard.writeText(path).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function handleResetSession() {
    if (!instanceId) return;
    const inst = instances.find((i) => i.id === instanceId);
    if (!inst) return;
    if (resetConfirmName !== inst.name) {
      toast.error('Instance name does not match');
      return;
    }
    setResetting(true);
    try {
      await api.post(`/instances/${instanceId}/reset-session`);
      toast.success('Session reset initiated');
      setShowResetModal(false);
      setResetConfirmName('');
    } catch (err: any) {
      toast.error('Reset failed: ' + (err?.message || 'unknown'));
    } finally {
      setResetting(false);
    }
  }

  const instance = instances.find((i) => i.id === instanceId);
  const driverHealthy = settings?.sessions?.driver === 'db' || settings?.sessions?.driver === 'file';
  const driverStatus = driverHealthy
    ? { color: 'bg-status-green', icon: CheckCircle2, text: 'Healthy' }
    : { color: 'bg-status-yellow', icon: AlertTriangle, text: 'Degraded' };

  return (
    <NPageHeader
      icon={Settings}
      title="Settings"
      subtitle="Studio configuration"
      actions={
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{testing ? 'Testing…' : 'Test'}</span>
          </Button>
          <Button variant="outline" onClick={fetchSettings} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reload</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 p-5">
        {!settings && !loading && (
          <NEmptyState
            icon={Settings}
            title="No settings available"
            description="Settings will appear once the backend is configured."
          />
        )}

        {settings && (
          <>
            {/* Connection Settings */}
            <SettingsGroup icon={Activity} title="Connection Settings">
              <SettingsRow label="Session Name">
                <Input
                  value={instance?.name || ''}
                  readOnly
                  className="h-8 w-48 text-right"
                />
              </SettingsRow>
              <SettingsRow label="Session Driver">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', driverStatus.color)} />
                  <span className="text-sm font-medium text-txt-primary">{settings.sessions?.driver || '-'}</span>
                  <span className="text-xs text-txt-muted">{driverStatus.text}</span>
                </div>
              </SettingsRow>
              <SettingsRow label="Session Path">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyPath(settings.sessions?.path || '')}
                  className="flex items-center gap-1.5 text-sm font-medium text-txt-primary transition-colors hover:text-brand"
                  title="Copy to clipboard"
                >
                  <span className="truncate max-w-[12rem]">{settings.sessions?.path || '-'}</span>
                  {copied ? <CheckCircle2 size={14} className="text-status-green" /> : <Copy size={14} className="text-txt-muted" />}
                </Button>
              </SettingsRow>
              {instance && (
                <div className="flex items-center gap-2 pt-1 text-xs text-txt-muted">
                  <span className={cn('h-1.5 w-1.5 rounded-full', instance.status === 'connected' ? 'bg-status-green' : 'bg-status-red')} />
                  <span className="capitalize">{instance.status}</span>
                  <span>·</span>
                  <span>Baileys</span>
                  <span>·</span>
                  <span>v6.x</span>
                </div>
              )}
            </SettingsGroup>

            {/* Message Settings */}
            <SettingsGroup icon={MessageSquare} title="Message Settings">
              <ToggleRow
                label="Read Receipts"
                description="Auto-mark incoming messages as read"
                checked={readReceipts}
                onChange={setReadReceipts}
              />
              <ToggleRow
                label="Typing Indicator"
                description="Show typing when the bot is preparing a reply"
                checked={typingIndicator}
                onChange={setTypingIndicator}
              />
              <ToggleRow
                label="Online Presence"
                description="Appear online when connected"
                checked={onlinePresence}
                onChange={setOnlinePresence}
              />
            </SettingsGroup>

            {/* Media Settings */}
            <SettingsGroup icon={Image} title="Media Settings">
              <ToggleRow
                label="Auto-Download Media"
                description="Fetch and persist incoming media automatically"
                checked={autoDownload}
                onChange={setAutoDownload}
              />
              <SettingsRow label="Max File Size (MB)">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxFileSize}
                  onChange={(e) => setMaxFileSize(Number(e.target.value))}
                  className="h-8 w-20 text-right"
                />
              </SettingsRow>
            </SettingsGroup>

            {/* Agents */}
            <SettingsGroup icon={Bot} title="Agents">
              <SettingsRow label="Default Agent">
                {settings.defaultAgent ? (
                  <span className="text-sm font-medium text-txt-primary">{settings.defaultAgent}</span>
                ) : (
                  <span className="text-sm text-txt-muted">No agents configured</span>
                )}
              </SettingsRow>
              <SettingsRow label="Webhook Count">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('wa-studio:navigate', { detail: 'webhooks' }));
                  }}
                  className="text-sm font-medium text-brand hover:underline h-auto p-0"
                >
                  {String(settings.webhooks ?? 0)}
                </Button>
              </SettingsRow>
            </SettingsGroup>

            {/* Rate Limiting */}
            <SettingsGroup icon={Gauge} title="Rate Limiting">
              <SliderRow
                label="Messages per Minute"
                min={10}
                max={120}
                value={messagesPerMinute}
                onChange={setMessagesPerMinute}
                leftLabel="Conservative"
                rightLabel="Aggressive"
              />
              <SliderRow
                label="Message Delay (ms)"
                min={0}
                max={2000}
                step={100}
                value={messageDelay}
                onChange={setMessageDelay}
                leftLabel="Fast"
                rightLabel="Natural"
              />
            </SettingsGroup>

            {/* Session Controls */}
            <SettingsGroup icon={Power} title="Session">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-status-red">Reset Session</span>
                  <span className="text-xs text-txt-muted">Delete all session data and start fresh</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowResetModal(true)}
                  className="border-status-red/30 text-status-red hover:bg-status-red/10 hover:text-status-red"
                >
                  Reset
                </Button>
              </div>
            </SettingsGroup>
          </>
        )}
      </div>

      <Dialog open={showResetModal} onOpenChange={(open) => { if (!open) { setShowResetModal(false); setResetConfirmName(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Session</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-xs text-txt-muted">
              This will delete all session data for <strong className="text-txt-secondary">{instance?.name}</strong> and force a re-pair.
            </p>
            <p className="text-xs text-txt-secondary">
              Type the instance name to confirm:
            </p>
            <Input
              value={resetConfirmName}
              onChange={(e) => setResetConfirmName(e.target.value)}
              placeholder={instance?.name}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowResetModal(false); setResetConfirmName(''); }}>
                Cancel
              </Button>
              <Button
                onClick={handleResetSession}
                disabled={resetting || resetConfirmName !== instance?.name}
                className="bg-status-red text-white hover:bg-status-red/90"
              >
                {resetting ? 'Resetting…' : 'Reset Session'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </NPageHeader>
  );
}

function SettingsGroup({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className="text-brand" />
        <h3 className="text-sm font-semibold text-txt-primary">{title}</h3>
      </div>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-txt-secondary">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-txt-primary">{label}</span>
        <span className="text-xs text-txt-muted">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-txt-primary">{label}</span>
        <span className="text-xs font-semibold text-brand">{value}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
      <div className="flex justify-between text-[10px] text-txt-muted">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
