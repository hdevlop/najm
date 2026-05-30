import { forwardRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { Button, NForm, FormInput, useNForm } from 'najm-ui';
import { z } from 'zod';
import type { SemanticFormState } from '../types';

interface SemanticFormProps {
  isCreating: boolean;
  editingId: string | null;
  form: SemanticFormState;
  availableTools: string[];
  langOptions: Array<{ value: string; label: string }>;
  onFormChange: (form: SemanticFormState) => void;
  onSave: () => void;
  onCancel: () => void;
}

const schema = z.object({
  phrase: z.string().trim().min(1, 'Phrase is required'),
  toolName: z.string().trim().min(1, 'Tool is required'),
  lang: z.string().min(1),
});

export const SemanticForm = forwardRef<HTMLDivElement, SemanticFormProps>(
  function SemanticForm({ editingId, form, availableTools, langOptions, onFormChange, onSave, onCancel }, ref) {
    const nform = useNForm({ schema, defaultValues: form, values: form });

    useEffect(() => {
      const sub = nform.watch((next: Partial<SemanticFormState>) => {
        onFormChange(next as SemanticFormState);
      });
      return () => sub.unsubscribe();
    }, [nform, onFormChange]);

    return (
      <div ref={ref}>
        <NForm
          schema={schema}
          form={nform}
          variant="studio"
          as="div"
          className="space-y-3"
          onSubmit={() => onSave()}
        >
          <FormInput
            name="phrase"
            type="textarea"
            formLabel="Phrase"
            placeholder="e.g. log me out immediately"
            rows={3}
            classNames={{ input: 'min-h-[120px] resize-y' }}
          />

          {availableTools.length > 0 ? (
            <FormInput
              name="toolName"
              type="combobox"
              formLabel="Target Tool"
              placeholder="Search and select a tool…"
              items={availableTools.map((t) => ({ value: t, label: t }))}
              allowFreeText
            />
          ) : (
            <FormInput
              name="toolName"
              type="text"
              formLabel="Target Tool"
              placeholder="Tool name (e.g. refunds_create)"
              classNames={{ input: 'font-mono' }}
            />
          )}

          <FormInput
            name="lang"
            type="select"
            formLabel="Language"
            items={langOptions}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onCancel} type="button">
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button type="submit" className="gap-1.5">
              <Check className="h-3.5 w-3.5" /> {editingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </NForm>
      </div>
    );
  },
);
