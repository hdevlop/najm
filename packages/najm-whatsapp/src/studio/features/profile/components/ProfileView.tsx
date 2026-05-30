import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Save, UserCircle, Check } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { useToast } from '@/lib/toast';
import type { Instance } from '@/features/instances/types';
import { NPageHeader, NEmptyState, Button, NForm, FormInput, useNForm } from 'najm-ui';

export function ProfileView() {
  const api = useApiClient();
  const toast = useToast();
  const { instanceId } = useSelectedInstance();
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const profileForm = useNForm({ defaultValues: { name: '', status: '' } });
  const profileValues = profileForm.watch() as { name: string; status: string };
  const { name, status } = profileValues;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [instances, setInstances] = useState<Instance[]>([]);

  const currentInstance = useMemo(
    () => instances.find((i) => i.id === instanceId),
    [instances, instanceId]
  );

  const currentName = currentInstance?.profileName || '';

  const isDirty = name.trim().length > 0 || status.trim().length > 0;
  const nameValid = name.length <= 25;
  const statusValid = status.length <= 139;

  useEffect(() => {
    if (!instanceId) return;
    setLoading(true);
    Promise.all([
      api.get(`/profile/${instanceId}/picture`).catch(() => ({ url: null })),
      api.get('/instances').catch(() => []),
    ])
      .then(([picData, instData]) => {
        setPictureUrl(picData.url || null);
        setInstances(instData || []);
      })
      .finally(() => setLoading(false));
  }, [api, instanceId]);

  async function handleSave(values: { name: string; status: string }) {
    if (!instanceId) return;
    if (!nameValid || !statusValid) return;

    setSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      if (values.name.trim()) {
        await api.post(`/profile/${instanceId}/name`, { name: values.name.trim() });
      }
      if (values.status.trim()) {
        await api.post(`/profile/${instanceId}/status`, { status: values.status.trim() });
      }
      toast.success('Profile updated');
      setSaveStatus('success');
      profileForm.reset({ name: '', status: '' });
      // Refresh instance list to get updated profileName
      const instData = await api.get('/instances');
      setInstances(instData || []);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handlePictureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !instanceId) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        await api.post(`/profile/${instanceId}/picture`, { buffer: base64 });
        toast.success('Picture updated');
        const picData = await api.get(`/profile/${instanceId}/picture`).catch(() => ({ url: null }));
        setPictureUrl(picData.url || null);
      } catch (err: any) {
        toast.error('Upload failed: ' + (err?.message || 'unknown'));
      }
    };
    reader.readAsDataURL(file);
  }

  if (!instanceId) {
    return (
      <NEmptyState
        icon={UserCircle}
        title="No instance selected"
        description="Select an instance to manage profile."
      />
    );
  }

  return (
    <NPageHeader
      icon={UserCircle}
      title="Profile"
      subtitle="Update your WhatsApp profile"
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-surface border border-border">
            {loading ? (
              <div className="h-full w-full animate-pulse bg-bg-muted/40" />
            ) : pictureUrl ? (
              <img src={pictureUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-txt-muted">
                <Camera size={24} />
              </div>
            )}
            {!loading && (
              <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity">
                <Camera size={16} className="text-white" />
                <span className="mt-1 text-[10px] text-white">Change photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePictureUpload} />
              </label>
            )}
          </div>
        </div>

        <NForm
          form={profileForm}
          variant="studio"
          onSubmit={(values) => handleSave(values as { name: string; status: string })}
          className="flex max-w-md flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            {currentName && (
              <p className="text-xs text-txt-muted">Current: &ldquo;{currentName}&rdquo;</p>
            )}
            <FormInput
              name="name"
              type="text"
              formLabel="Name"
              placeholder="New display name"
            />
            <div className="flex justify-end">
              <span className={cn('text-[10px]', name.length > 25 ? 'text-status-red' : 'text-txt-muted')}>
                {name.length}/25
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <FormInput
              name="status"
              type="text"
              formLabel="Status"
              placeholder="New status text"
            />
            <div className="flex justify-end">
              <span className={cn('text-[10px]', status.length > 139 ? 'text-status-red' : 'text-txt-muted')}>
                {status.length}/139
              </span>
            </div>
          </div>

          {saveStatus === 'error' && saveError && (
            <p className="text-xs text-status-red">{saveError}</p>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={saving || !isDirty || !nameValid || !statusValid}
              className="w-fit gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            {saveStatus === 'success' && (
              <span className="flex items-center gap-1 text-xs text-status-green">
                <Check size={12} /> Saved
              </span>
            )}
          </div>
        </NForm>
      </div>
    </NPageHeader>
  );
}
