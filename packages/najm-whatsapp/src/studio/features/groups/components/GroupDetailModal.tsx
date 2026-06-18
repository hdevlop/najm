import React, { useEffect, useState } from 'react';
import { Shield, User, UserPlus, UserMinus, ShieldOff, Plus } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type { GroupMetadata } from '@/features/groups/types';
import { Button, FormInput, NForm, Switch, Dialog, DialogContent, DialogHeader, DialogTitle, useNForm } from 'najm-kit';

interface GroupDetailModalProps {
  instanceId: string;
  jid: string;
  onClose: () => void;
}

type ParticipantAction = 'add' | 'remove' | 'promote' | 'demote';

export function GroupDetailModal({ instanceId, jid, onClose }: GroupDetailModalProps) {
  const api = useApiClient();
  const toast = useToast();
  const [meta, setMeta] = useState<GroupMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const participantForm = useNForm({ defaultValues: { participant: '' } });
  const newParticipant = (participantForm.watch() as { participant: string }).participant;

  async function fetchMeta() {
    setLoading(true);
    try {
      const data = await api.get(`/groups/${instanceId}/${jid}/metadata`);
      setMeta(data);
    } catch (err: any) {
      toast.error('Failed to load group: ' + (err?.message || 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMeta();
  }, [api, instanceId, jid]);

  async function toggleSetting(setting: 'announcement' | 'locked') {
    if (!meta) return;
    const next = !meta.settings[setting];
    const payload =
      setting === 'announcement'
        ? next ? 'announcement' : 'not_announcement'
        : next ? 'locked' : 'unlocked';
    try {
      await api.patch(`/groups/${instanceId}/${jid}/settings`, { setting: payload });
      setMeta({ ...meta, settings: { ...meta.settings, [setting]: next } });
      toast.success(`Setting updated`);
    } catch (err: any) {
      toast.error('Setting update failed: ' + (err?.message || 'unknown'));
    }
  }

  async function participantAction(participantJid: string, action: ParticipantAction) {
    const key = `${action}:${participantJid}`;
    setBusy(key);
    try {
      await api.post(`/groups/${instanceId}/${jid}/participants`, {
        participants: [participantJid],
        action,
      });
      toast.success(`${action} succeeded`);
      await fetchMeta();
    } catch (err: any) {
      toast.error(`${action} failed: ${err?.message || 'unknown'}`);
    } finally {
      setBusy(null);
    }
  }

  async function addParticipant(values: { participant: string }) {
    const raw = values.participant.trim();
    if (!raw) return;
    const jidLike = raw.includes('@') ? raw : `${raw.replace(/\D/g, '')}@s.whatsapp.net`;
    await participantAction(jidLike, 'add');
    participantForm.reset({ participant: '' });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg flex flex-col h-[80vh]">
        <DialogHeader>
          <DialogTitle>{meta?.subject || jid}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-1 items-center justify-center text-xs text-txt-muted">
            Loading...
          </div>
        )}

        {!loading && meta && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-1">
            {meta.desc && (
              <div className="text-xs text-txt-secondary">{meta.desc}</div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="group-announcement"
                  checked={!!meta.settings.announcement}
                  onCheckedChange={() => toggleSetting('announcement')}
                />
                <label htmlFor="group-announcement" className="text-sm text-txt-primary cursor-pointer">
                  Announcement only
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="group-locked"
                  checked={!!meta.settings.locked}
                  onCheckedChange={() => toggleSetting('locked')}
                />
                <label htmlFor="group-locked" className="text-sm text-txt-primary cursor-pointer">
                  Locked
                </label>
              </div>
            </div>

            <NForm
              form={participantForm}
              variant="studio"
              onSubmit={(values) => addParticipant(values as { participant: string })}
              className="flex-row items-center gap-2"
            >
              <FormInput
                name="participant"
                type="text"
                placeholder="Phone or JID (e.g. 5511999887766)"
                classNames={{ item: 'flex-1' }}
              />
              <Button
                size="sm"
                type="submit"
                disabled={!newParticipant.trim() || !!busy}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </NForm>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-txt-muted">
                Participants ({meta.participants.length})
              </span>
              <div className="flex flex-col gap-1">
                {meta.participants.map((p) => (
                  <div
                    key={p.jid}
                    className="flex items-center gap-2 rounded-md bg-surface px-3 py-2"
                  >
                    <User size={14} className="text-txt-muted" />
                    <span className="flex-1 truncate text-xs text-txt-primary">{p.jid}</span>
                    {p.isSuperAdmin && <Shield size={12} className="text-brand" aria-label="Super admin" />}
                    {p.isAdmin && !p.isSuperAdmin && <Shield size={12} className="text-txt-secondary" aria-label="Admin" />}

                    {!p.isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        {p.isAdmin ? (
                          <button
                            onClick={() => participantAction(p.jid, 'demote')}
                            disabled={!!busy}
                            aria-label={`Demote ${p.jid}`}
                            className="rounded p-1 text-txt-muted hover:bg-card-hover hover:text-txt-primary disabled:opacity-50"
                          >
                            <ShieldOff size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => participantAction(p.jid, 'promote')}
                            disabled={!!busy}
                            aria-label={`Promote ${p.jid}`}
                            className="rounded p-1 text-txt-muted hover:bg-card-hover hover:text-txt-primary disabled:opacity-50"
                          >
                            <Shield size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => participantAction(p.jid, 'remove')}
                          disabled={!!busy}
                          aria-label={`Remove ${p.jid}`}
                          className="rounded p-1 text-status-red/70 hover:bg-card-hover hover:text-status-red disabled:opacity-50"
                        >
                          <UserMinus size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
