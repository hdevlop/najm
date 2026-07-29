'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormInput, NAlert, NButton, NForm, NSheet } from 'najm-kit';
import { FolderPlus, Loader2 } from 'lucide-react';
import { INITIAL_THEME_ACCENTS, type CreateProjectInput } from '@/app/use-projects';
import { DEFAULT_PRESET, PRESETS } from '@/theme/presets';

const NEW_PROJECT_FORM_ID = 'theme-studio-new-project-form';

const newProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.'),
  slug: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      'Slug can use lowercase letters, numbers, and single hyphens.',
    ),
  description: z.string().trim().max(500, 'Description must be 500 characters or less.'),
  presetId: z.string().min(1),
  accent: z.enum(['neutral', 'emerald', 'green', 'slate', 'blue', 'violet']),
});

type NewProjectFormValues = z.infer<typeof newProjectSchema>;

function defaultValues(): NewProjectFormValues {
  return {
    name: '',
    slug: '',
    description: '',
    presetId: DEFAULT_PRESET.id,
    accent: DEFAULT_PRESET.config.theme.accent ?? 'neutral',
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateProjectInput) => Promise<unknown>;
}) {
  const form = useForm<NewProjectFormValues>({
    defaultValues: defaultValues(),
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const busy = form.formState.isSubmitting;
  const projectName = form.watch('name');

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues());
    setSlugEdited(false);
    setFormError(undefined);
  }, [form, open]);

  async function handleCreateProject(values: NewProjectFormValues) {
    setFormError(undefined);
    try {
      const project = await onCreate({
        name: values.name.trim(),
        slug: values.slug.trim() || undefined,
        description: values.description.trim() || undefined,
        presetId: values.presetId,
        accent: values.accent,
      });
      if (!project) {
        setFormError('Project could not be created. Check the project name or slug.');
      }
    } catch (error) {
      setFormError((error as Error).message);
    }
  }

  return (
    <NSheet
      icon={FolderPlus}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen);
      }}
      title="New Project"
      description="Create a theme project for saved styles."
      width={420}
      footer={
        <div className="flex items-center justify-end gap-2">
          <NButton type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </NButton>
          <NButton type="submit" form={NEW_PROJECT_FORM_ID} disabled={busy || !projectName.trim()}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating
              </>
            ) : (
              'Create project'
            )}
          </NButton>
        </div>
      }
    >
      <NForm
        id={NEW_PROJECT_FORM_ID}
        schema={newProjectSchema}
        form={form}
        variant="studio"
        bordered
        className="gap-4"
        onSubmit={handleCreateProject}
      >
        <FormInput
          name="name"
          type="text"
          formLabel="Name"
          placeholder="School Dashboard"
          required
          onChange={(next: string) => {
            if (!slugEdited) {
              form.setValue('slug', slugify(next), { shouldDirty: true, shouldValidate: true });
            }
          }}
        />
        <FormInput
          name="slug"
          type="text"
          formLabel="Slug"
          placeholder="school-dashboard"
          onChange={(next: string) => {
            setSlugEdited(true);
            form.setValue('slug', slugify(next), { shouldDirty: true, shouldValidate: true });
          }}
        />
        <FormInput
          name="description"
          type="textarea"
          formLabel="Description"
          placeholder="Optional note for this theme project"
          rows={4}
          className="min-h-24"
        />
        <div className="grid grid-cols-2 gap-2">
          <FormInput
            name="presetId"
            type="select"
            formLabel="Initial preset"
            items={PRESETS.map((preset) => ({ value: preset.id, label: preset.name }))}
            onChange={(nextPresetId: string) => {
              const preset = PRESETS.find((item) => item.id === nextPresetId) ?? DEFAULT_PRESET;
              form.setValue('accent', preset.config.theme.accent ?? 'neutral', {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
          <FormInput
            name="accent"
            type="select"
            formLabel="Initial accent"
            items={INITIAL_THEME_ACCENTS.map((item) => ({ value: item, label: item }))}
          />
        </div>
        {formError ? (
          <NAlert variant="destructive" description={formError} />
        ) : null}
      </NForm>
    </NSheet>
  );
}
