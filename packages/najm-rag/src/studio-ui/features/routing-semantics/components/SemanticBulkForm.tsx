import { useMemo, useState } from 'react';
import { Check, X, FileJson } from 'lucide-react';
import { Button, NForm, FormInput, useNForm } from 'najm-kit';
import { z } from 'zod';
import { parseBulkSemanticJson } from '../utils/helpers';
import type { BulkSemanticItem } from '../types';

interface Props {
  availableTools: string[];
  allowedLangs?: string[];
  onSave: (items: BulkSemanticItem[]) => Promise<void> | void;
  onCancel: () => void;
}

const schema = z.object({
  tool: z.string().trim().min(1, 'Pick a tool'),
  json: z.string().trim().min(1, 'Paste language JSON'),
});

type FormValues = z.infer<typeof schema>;

export function SemanticBulkForm({ availableTools, allowedLangs, onSave, onCancel }: Props) {
  const nform = useNForm<typeof schema>({ schema, defaultValues: { tool: '', json: '' } });
  const [saving, setSaving] = useState(false);
  const { tool, json } = nform.watch();

  const result = useMemo(
    () => (json?.trim() ? parseBulkSemanticJson(json, tool ?? '', allowedLangs) : null),
    [json, tool, allowedLangs],
  );

  const total = result?.items.length ?? 0;
  const canSave = !!result && !result.error && total > 0 && !saving;

  const handleSubmit = async (_values: FormValues) => {
    if (!result || result.error || result.items.length === 0) return;
    setSaving(true);
    try { await onSave(result.items); }
    finally { setSaving(false); }
  };

  return (
    <NForm
      schema={schema}
      form={nform}
      variant="studio"
      as="div"
      className="space-y-5"
      onSubmit={handleSubmit}
    >
      <FormInput
        name="tool"
        type="combobox"
        formLabel="Target Tool"
        placeholder="Search and select a tool…"
        items={availableTools.map((t) => ({ value: t, label: t }))}
        allowFreeText
      />

      <FormInput
        name="json"
        type="textarea"
        formLabel="Language JSON"
        rows={20}
        placeholder={'{\n  "en": ["take down my listing"],\n  "fr": ["retire mon annonce"]\n}'}
        classNames={{ input: 'font-mono text-xs min-h-[420px]' }}
      />

      {result && (
        <div className="rounded-md border border-border bg-card/40 p-3 text-xs space-y-2">
          {result.error ? (
            <p className="text-status-red">{result.error}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-txt-primary">
                <FileJson className="h-3.5 w-3.5 text-brand" />
                <span className="font-semibold">{total} phrases</span>
                <span className="text-txt-muted">across {result.countsByLang.length} languages</span>
              </div>
              <ul className="grid grid-cols-2 gap-1 text-txt-muted">
                {result.countsByLang.map(({ lang, total }) => (
                  <li key={lang}><span className="font-mono">{lang}</span>: {total}</li>
                ))}
              </ul>
              {result.warnings.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-status-amber">
                  {result.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" type="button" onClick={onCancel} disabled={saving}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" type="submit" disabled={!canSave}>
          <Check className="h-3.5 w-3.5" /> Save All ({total})
        </Button>
      </div>
    </NForm>
  );
}
