import React, { useCallback, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { Decoration, EditorView, ViewPlugin, keymap } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';
import { EditorSelection, RangeSetBuilder } from '@codemirror/state';
import { Button } from "../components/Button";
import { AlertCircle, Loader2, ClipboardPaste, Copy, RotateCcw } from 'lucide-react';
import { cn } from '../lib/cn';
import type { JsonViewColors } from './types';

export interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
  onCancel: () => void;
  dirty: boolean;
  parseError: string | null;
  saveError: string | null;
  saveSuccess: string | null;
  loading: boolean;
  saving: boolean;
  colors: JsonViewColors;
  lineCount: number;
  itemCount: number;
  itemLabel: string;
  loadingLabel: string;
  readOnly?: boolean;
  smartPasteLabel?: string;
  onSmartPaste?: () => void;
  onCopy?: () => void;
  copyLabel?: string;
  headerMiddle?: React.ReactNode;
  statusAddon?: React.ReactNode;
  showActions?: boolean;
  highlightDuplicateStrings?: boolean;
  highlightStatusStrings?: boolean;
}

function buildStudioTheme(colors: JsonViewColors): Extension {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: colors.background,
        fontSize: '0.875rem',
        fontFamily: "'JetBrains Mono', monospace",
        height: '100%',
        minHeight: 0,
      },
      '.cm-scroller': {
        backgroundColor: colors.background,
        overflow: 'auto',
      },
      '.cm-content': {
        caretColor: colors.phrase,
        backgroundColor: colors.background,
        paddingTop: '1rem',
        paddingBottom: '1rem',
        color: '#e2e8f0',
      },
      '.cm-gutters': {
        backgroundColor: colors.background,
        color: colors.bracket + '88',
        borderRight: 'none',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.875rem',
      },
      '.cm-activeLineGutter': {
        backgroundColor: colors.bracket + '11',
      },
      '.cm-activeLine': {
        backgroundColor: colors.bracket + '0D',
      },
      '.cm-selectionBackground': {
        backgroundColor: colors.bracket + '33',
      },
      '.cm-cursor': {
        borderLeftColor: colors.phrase,
      },
      '.cm-line': {
        padding: '0 1rem',
      },
      '@media (max-width: 640px)': {
        '&': {
          fontSize: '0.75rem',
        },
        '.cm-gutters': {
          display: 'none',
        },
        '.cm-content': {
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem',
        },
        '.cm-line': {
          padding: '0 0.5rem',
        },
      },
    },
    { dark: true }
  );
}

function buildJsonHighlightStyle(colors: JsonViewColors): Extension {
  const highlightStyle = HighlightStyle.define([
    { tag: tags.string, color: colors.string },
    { tag: tags.number, color: colors.number },
    { tag: tags.propertyName, color: colors.key },
    { tag: tags.bool, color: colors.number },
    { tag: tags.null, color: colors.number },
    { tag: tags.bracket, color: colors.bracket },
    { tag: tags.squareBracket, color: colors.bracket },
    { tag: tags.brace, color: colors.bracket },
    { tag: tags.punctuation, color: colors.bracket },
  ]);
  return syntaxHighlighting(highlightStyle);
}

function buildDuplicateStringHighlight(colors: JsonViewColors): Extension {
  const duplicateMark = Decoration.mark({
    attributes: {
      style: `background-color: ${colors.phrase}22; box-shadow: inset 0 0 0 1px ${colors.phrase}55; border-radius: 3px;`,
    },
  });

  const collectDuplicateRanges = (doc: string) => {
    const stringPattern = /"(?:\\.|[^"\\])*"/g;
    const occurrences = new Map<string, Array<{ from: number; to: number }>>();
    let match: RegExpExecArray | null;

    while ((match = stringPattern.exec(doc)) !== null) {
      const token = match[0]!;
      const after = doc.slice(match.index + token.length).match(/^\s*:/);
      if (after) continue;

      let value = '';
      try {
        value = JSON.parse(token);
      } catch {
        continue;
      }
      if (typeof value !== 'string' || value.trim().length === 0) continue;

      const ranges = occurrences.get(value) ?? [];
      ranges.push({ from: match.index, to: match.index + token.length });
      occurrences.set(value, ranges);
    }

    return Array.from(occurrences.values()).filter((ranges) => ranges.length > 1).flat();
  };

  return ViewPlugin.fromClass(
    class {
      decorations;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const ranges = collectDuplicateRanges(view.state.doc.toString());
        ranges.sort((a, b) => a.from - b.from || a.to - b.to);
        for (const range of ranges) {
          builder.add(range.from, range.to, duplicateMark);
        }
        return builder.finish();
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    }
  );
}

function buildStatusStringHighlight(): Extension {
  const marks = {
    fail: Decoration.mark({
      attributes: {
        style: 'background-color: rgba(239, 68, 68, 0.18); color: #fca5a5; box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.45); border-radius: 3px;',
      },
    }),
    low_confidence: Decoration.mark({
      attributes: {
        style: 'background-color: rgba(245, 158, 11, 0.18); color: #fcd34d; box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.45); border-radius: 3px;',
      },
    }),
    pass: Decoration.mark({
      attributes: {
        style: 'background-color: rgba(16, 185, 129, 0.18); color: #6ee7b7; box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.45); border-radius: 3px;',
      },
    }),
    pending: Decoration.mark({
      attributes: {
        style: 'background-color: rgba(148, 163, 184, 0.14); color: #cbd5e1; box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.35); border-radius: 3px;',
      },
    }),
    missing: Decoration.mark({
      attributes: {
        style: 'background-color: rgba(239, 68, 68, 0.18); color: #fca5a5; box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.45); border-radius: 3px;',
      },
    }),
    extra: Decoration.mark({
      attributes: {
        style: 'background-color: rgba(245, 158, 11, 0.18); color: #fcd34d; box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.45); border-radius: 3px;',
      },
    }),
  } as const;

  return ViewPlugin.fromClass(
    class {
      decorations;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc.toString();
        const ranges: Array<{ from: number; to: number; mark: Decoration }> = [];
        const pattern = /"status"\s*:\s*"(fail|low_confidence|pass|pending)"/g;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(doc)) !== null) {
          const status = match[1] as keyof typeof marks;
          const valueStart = match.index + match[0]!.lastIndexOf(`"${status}"`);
          ranges.push({ from: valueStart, to: valueStart + status.length + 2, mark: marks[status] });
        }

        const toolArrayPattern = /"(missingTools|extraTools)"\s*:\s*\[([\s\S]*?)\]/g;
        let arrayMatch: RegExpExecArray | null;
        while ((arrayMatch = toolArrayPattern.exec(doc)) !== null) {
          const key = arrayMatch[1];
          const content = arrayMatch[2] ?? '';
          const contentStart = arrayMatch.index + arrayMatch[0]!.indexOf(content);
          const stringPattern = /"(?:\\.|[^"\\])*"/g;
          let stringMatch: RegExpExecArray | null;
          while ((stringMatch = stringPattern.exec(content)) !== null) {
            const from = contentStart + stringMatch.index;
            const to = from + stringMatch[0]!.length;
            ranges.push({ from, to, mark: key === 'missingTools' ? marks.missing : marks.extra });
          }
        }

        ranges.sort((a, b) => a.from - b.from || a.to - b.to);
        for (const range of ranges) builder.add(range.from, range.to, range.mark);

        return builder.finish();
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    }
  );
}

export function JsonEditor({
  value,
  onChange,
  onSave,
  onReset,
  onCancel,
  dirty,
  parseError,
  saveError,
  saveSuccess,
  loading,
  saving,
  colors,
  lineCount,
  itemCount,
  itemLabel,
  loadingLabel,
  readOnly = false,
  smartPasteLabel,
  onSmartPaste,
  onCopy,
  copyLabel,
  headerMiddle,
  statusAddon,
  showActions = true,
  highlightDuplicateStrings = false,
  highlightStatusStrings = false,
}: JsonEditorProps) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const parseErrorRef = useRef(parseError);
  parseErrorRef.current = parseError;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const customKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            if (dirtyRef.current && !parseErrorRef.current && !savingRef.current) {
              onSaveRef.current();
            }
            return true;
          },
        },
      ]),
    []
  );

  const selectAllKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: 'Mod-a',
          run: (view) => {
            view.dispatch({
              selection: EditorSelection.range(0, view.state.doc.length),
            });
            return true;
          },
        },
      ]),
    []
  );

  const theme = useMemo(() => buildStudioTheme(colors), [colors]);
  const highlightStyle = useMemo(() => buildJsonHighlightStyle(colors), [colors]);
  const duplicateStringHighlight = useMemo(
    () => buildDuplicateStringHighlight(colors),
    [colors]
  );
  const statusStringHighlight = useMemo(() => buildStatusStringHighlight(), []);

  const extensions = useMemo<Extension[]>(
    () => [
      json(),
      theme,
      highlightStyle,
      customKeymap,
      selectAllKeymap,
      EditorView.lineWrapping,
      ...(highlightDuplicateStrings ? [duplicateStringHighlight] : []),
      ...(highlightStatusStrings ? [statusStringHighlight] : []),
    ],
    [
      json,
      theme,
      highlightStyle,
      customKeymap,
      selectAllKeymap,
      highlightDuplicateStrings,
      duplicateStringHighlight,
      highlightStatusStrings,
      statusStringHighlight,
    ]
  );

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
    },
    [onChange]
  );

  const statusMessage = useMemo(() => {
    if (loading) return { text: loadingLabel, type: 'loading' as const };
    if (saving) return { text: 'Saving...', type: 'saving' as const };
    if (saveError) return { text: saveError.slice(0, 120), type: 'error' as const };
    if (dirty) {
      if (parseError) return { text: `JSON error: ${parseError.slice(0, 120)}`, type: 'error' as const };
      return { text: 'Valid JSON - unsaved changes', type: 'success' as const };
    }
    return { text: readOnly ? 'Read-only' : 'Saved', type: 'idle' as const };
  }, [loading, saving, saveError, dirty, parseError, loadingLabel, readOnly]);

  const dotClass = saving
    ? 'bg-amber-400 animate-ping'
    : !saving && dirty && parseError
    ? 'bg-rose-500'
    : !saving && dirty && !parseError
    ? 'bg-amber-400'
    : 'bg-emerald-600';

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: colors.background }}>
      <div
        className="relative flex items-center justify-between gap-3 border-b px-3 py-2 shrink-0 sm:px-4"
        style={{ borderColor: colors.bracket + '44', minHeight: '44px' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {statusMessage.type === 'loading' && (
            <span className="shrink-0 text-xs text-muted-foreground">{statusMessage.text}</span>
          )}
          {statusMessage.type === 'saving' && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-amber-400 animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> {statusMessage.text}
            </span>
          )}
          {statusMessage.type === 'error' && (
            <span className="truncate text-xs text-rose-400">
              <AlertCircle className="h-3 w-3 inline mr-1" /> {statusMessage.text}
            </span>
          )}
          {statusMessage.type === 'success' && (
            <span className="shrink-0 text-xs text-emerald-400">{statusMessage.text}</span>
          )}
          {statusMessage.type === 'idle' && (
            <span className="shrink-0 text-xs" style={{ color: colors.bracket }}>
              {statusMessage.text}
            </span>
          )}
          {statusAddon && <div className="min-w-0 flex-1">{statusAddon}</div>}
        </div>
        {headerMiddle && (
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            {headerMiddle}
          </div>
        )}
        {showActions && (
        <div className="flex shrink-0 items-center gap-1.5 najm-overlay-scroll-x">
          {onSmartPaste && (
            <Button variant="secondary" disabled={saving || loading} onClick={onSmartPaste} title="Paste &amp; merge JSON from clipboard" className="gap-1.5 whitespace-nowrap px-2 sm:px-3">
              <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
              <span>{smartPasteLabel ?? 'Paste'}</span>
            </Button>
          )}
          {onCopy && (
            <Button variant="outline" disabled={loading} onClick={onCopy} title="Copy JSON to clipboard" className="gap-1.5 whitespace-nowrap px-2 sm:px-3">
              <Copy className="h-3.5 w-3.5 mr-1" />
              {copyLabel ?? 'Copy'}
            </Button>
          )}
          <Button variant="ghost" disabled={!dirty || saving} onClick={onReset} title="Reset all JSON changes" className="gap-1.5 whitespace-nowrap px-2 sm:px-3">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset All
          </Button>
        </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> {loadingLabel}
          </div>
        ) : (
          <CodeMirror
            value={value}
            className="absolute inset-0"
            height="100%"
            extensions={extensions}
            onChange={handleChange}
            editable={!readOnly && !saving}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: false,
              dropCursor: false,
              allowMultipleSelections: false,
              indentOnInput: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: false,
              searchKeymap: false,
            }}
          />
        )}
      </div>

      <div
        className="grid gap-1.5 border-t px-3 py-2 text-[11px] shrink-0 sm:flex sm:items-center sm:justify-between sm:px-4 sm:py-1.5"
        style={{ color: colors.bracket, borderColor: colors.bracket + '33' }}
      >
        <div className="hidden items-center gap-4 sm:flex">
          <span>Edit freely - copy, paste, find &amp; replace</span>
          <span>Ctrl+S to save</span>
        </div>

        <div className="flex min-w-0 justify-start sm:flex-1 sm:justify-center sm:px-4">
          {saveSuccess && (
            <span className="text-emerald-400 truncate">{saveSuccess}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{lineCount} lines</span>
          <span>
            {itemCount} {itemLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
            <span className={dirty ? 'text-amber-400' : 'text-emerald-400'}>
              {saving ? 'Saving…' : dirty ? 'Modified' : 'Saved'}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
