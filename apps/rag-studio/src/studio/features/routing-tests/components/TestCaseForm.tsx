import { useEffect } from 'react';
import { Button, Badge, NForm, FormInput, useNForm } from 'najm-kit';
import { Check, Plus, Save, X } from 'lucide-react';
import { z } from 'zod';
import { ALL_LANG_OPTIONS } from '@/features/routing-semantics/constants';

interface TestCaseFormProps {
  availableTools: string[];
  form: { name: string; query: string; lang: string; expectedTool: string };
  formExpectedTools: string[];
  editingId: string | null;
  onFormChange: (field: 'name' | 'query' | 'lang' | 'expectedTool', value: string) => void;
  onAddExpectedTool: () => void;
  onRemoveExpectedTool: (tool: string) => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
  allowedLangs?: string[];
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  query: z.string().trim().min(1, 'Query is required'),
  lang: z.string().min(1, 'Language is required'),
  expectedTool: z.string(),
});

export function TestCaseForm({
  availableTools,
  form,
  formExpectedTools,
  editingId,
  onFormChange,
  onAddExpectedTool,
  onRemoveExpectedTool,
  onSave,
  onCancel,
  canSave,
  allowedLangs,
}: TestCaseFormProps) {
  const nform = useNForm<typeof schema>({
    schema,
    defaultValues: form,
    values: form,
  });

  useEffect(() => {
    const sub = nform.watch((values, { name }) => {
      if (!name) return;
      const next = values[name];
      if (typeof next === 'string') {
        onFormChange(name as 'name' | 'query' | 'lang' | 'expectedTool', next);
      }
    });
    return () => sub.unsubscribe();
  }, [nform, onFormChange]);

  const langOptions = (allowedLangs && allowedLangs.length > 0
    ? ALL_LANG_OPTIONS.filter((o) => allowedLangs.includes(o.value))
    : ALL_LANG_OPTIONS);

  return (
    <NForm
      schema={schema}
      form={nform}
      variant="studio"
      as="div"
      className="space-y-4"
      onSubmit={() => { if (canSave) onSave(); }}
    >
      <FormInput
        name="name"
        type="text"
        formLabel="Test Name"
        placeholder="e.g. Logout flow"
      />

      <FormInput
        name="lang"
        type="combobox"
        formLabel="Language"
        placeholder="Select language…"
        items={langOptions.map((o) => ({ value: o.value, label: `${o.label} (${o.value})` }))}
      />

      <div className="space-y-1.5">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            {availableTools.length > 0 ? (
              <FormInput
                name="expectedTool"
                type="combobox"
                formLabel="Expected Tools"
                placeholder="Search and select a tool…"
                items={availableTools.map((t) => ({ value: t, label: t }))}
                allowFreeText
              />
            ) : (
              <FormInput
                name="expectedTool"
                type="text"
                formLabel="Expected Tools"
                placeholder="Tool name"
                classNames={{ input: 'font-mono' }}
              />
            )}
          </div>
          <Button
            type="button"
            onClick={onAddExpectedTool}
            disabled={!form.expectedTool.trim()}
            className="h-10 gap-1 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        {formExpectedTools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {formExpectedTools.map((tool) => (
              <Badge key={tool} variant="outline" className="gap-1 rounded-md px-2 py-0.5 font-mono text-xs pr-1">
                {tool}
                <button
                  type="button"
                  onClick={() => onRemoveExpectedTool(tool)}
                  className="ml-0.5 text-txt-muted hover:text-status-red"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <FormInput
        name="query"
        type="textarea"
        formLabel="Query"
        placeholder="Enter the user query to test..."
        rows={4}
        classNames={{ input: 'min-h-[120px] resize-y' }}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" type="button" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button type="submit" disabled={!canSave} className="gap-1.5">
          {editingId ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {editingId ? 'Update Test' : 'Save Test'}
        </Button>
      </div>
    </NForm>
  );
}
