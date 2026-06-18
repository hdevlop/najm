import { useState, useCallback, useMemo } from 'react';
import { NSheet } from './NSheet';
import { Button } from "../Button";
import { Textarea } from "../ui/textarea";
import { AlertCircle, Merge, CheckCircle2 } from 'lucide-react';

export interface JsonViewColors {
  background: string;
  phrase: string;
  bracket: string;
}

export interface SmartPastePreview {
  mergedJson: string;
  newCount: number;
  dupeCount: number;
  label: string;
}

export interface NSmartPasteDialogProps {
  open: boolean;
  currentJson: string;
  colors: JsonViewColors;
  title?: string;
  /** Short text shown in the header under the title. */
  subtitle?: string;
  /** Long-form helper text shown above the textarea. */
  description?: string;
  placeholder?: string;
  emptyMessage?: string;
  itemLabel: string;
  onMerge: (mergedJson: string) => void;
  onCancel: () => void;
  parseAndPreview: (pasteJson: unknown, currentJson: string) => SmartPastePreview | null;
}

export function NSmartPasteDialog({
  open,
  currentJson,
  colors,
  title = 'Smart Paste & Merge',
  subtitle,
  description,
  placeholder,
  emptyMessage = 'Could not extract any data from this JSON.',
  itemLabel,
  onMerge,
  onCancel,
  parseAndPreview,
}: NSmartPasteDialogProps) {
  const [pasteText, setPasteText] = useState('');

  const { parsed, parseError } = useMemo(() => {
    if (!pasteText.trim()) return { parsed: null, parseError: null };
    try {
      return { parsed: JSON.parse(pasteText), parseError: null };
    } catch (e: any) {
      return { parsed: null, parseError: e.message };
    }
  }, [pasteText]);

  const preview = useMemo(() => {
    if (!parsed) return null;
    return parseAndPreview(parsed, currentJson);
  }, [parsed, currentJson, parseAndPreview]);

  const handleMerge = useCallback(() => {
    if (!preview) return;
    onMerge(preview.mergedJson);
    setPasteText('');
  }, [preview, onMerge]);

  const handleCancel = useCallback(() => {
    setPasteText('');
    onCancel();
  }, [onCancel]);

  return (
    <NSheet
      open={open}
      onOpenChange={(o) => { if (!o) handleCancel(); }}
      title={title}
      description={subtitle}
      width={560}
      bodyClassName="px-6 pt-2 pb-5 flex flex-col"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button
            onClick={handleMerge}
            disabled={!preview || preview.newCount === 0}
          >
            <Merge className="h-3.5 w-3.5 mr-1.5" />
            {preview ? `Merge ${preview.newCount} ${itemLabel}${preview.newCount !== 1 ? 's' : ''}` : 'Merge'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-3 min-h-0">
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
        <Textarea
          className="flex-1 min-h-[400px] font-mono text-xs resize-none"
          placeholder={placeholder}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          autoFocus
        />

        {parseError && (
          <div className="flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Invalid JSON: {parseError}</span>
          </div>
        )}

        {!parseError && pasteText.trim() && parsed !== null && !preview && (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{emptyMessage}</span>
          </div>
        )}

        {preview && (
          <div className="rounded-lg border border-border px-3 py-2 text-xs space-y-1" style={{ background: colors.background }}>
            <div className="flex items-center gap-2 font-medium" style={{ color: colors.phrase }}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready to merge
            </div>
            <div style={{ color: colors.bracket }} className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>{preview.label}</span>
              <span style={{ color: colors.phrase }}>{preview.newCount} new {itemLabel}{preview.newCount !== 1 ? 's' : ''}</span>
              {preview.dupeCount > 0 && (
                <span className="text-amber-400">{preview.dupeCount} already exist{preview.dupeCount !== 1 ? 's' : ''} (skipped)</span>
              )}
            </div>
          </div>
        )}
      </div>
    </NSheet>
  );
}
