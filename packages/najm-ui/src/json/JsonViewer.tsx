import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView, keymap } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { cn } from '../lib/cn';
import type { JsonViewColors } from './types';

export interface JsonViewerProps {
  value: unknown;
  colors?: JsonViewColors;
  className?: string;
  maxHeight?: string;
}

const defaultJsonViewColors: JsonViewColors = {
  toolName: '#10b981',
  langCode: '#f59e0b',
  phrase: '#06b6d4',
  bracket: '#9ca3af',
  key: '#a78bfa',
  string: '#34d399',
  number: '#f472b6',
  background: '#1f2937',
};

function buildStudioTheme(colors: JsonViewColors, fullPage = false): Extension {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: colors.background,
        fontSize: '0.8125rem',
        fontFamily: "'JetBrains Mono', monospace",
        height: fullPage ? '100%' : 'auto',
        minHeight: fullPage ? 0 : undefined,
      },
      '.cm-scroller': {
        backgroundColor: colors.background,
        overflow: 'auto',
      },
      '.cm-content': {
        backgroundColor: colors.background,
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        color: '#e2e8f0',
      },
      '.cm-gutters': {
        backgroundColor: colors.background,
        color: colors.bracket + '88',
        borderRight: 'none',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.8125rem',
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
      '.cm-line': {
        padding: '0 0.75rem',
      },
      '@media (max-width: 640px)': {
        '&': {
          fontSize: '0.75rem',
        },
        '.cm-gutters': {
          display: 'none',
        },
        '.cm-line': {
          padding: '0 0.5rem',
        },
        '.cm-content': {
          paddingTop: '0.375rem',
          paddingBottom: '0.375rem',
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

export function JsonViewer({ value, colors = defaultJsonViewColors, className, maxHeight = '240px' }: JsonViewerProps) {
  const fullPage = maxHeight === 'none';

  const text = useMemo(() => {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const theme = useMemo(() => buildStudioTheme(colors, fullPage), [colors, fullPage]);
  const highlightStyle = useMemo(() => buildJsonHighlightStyle(colors), [colors]);

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

  const extensions = useMemo<Extension[]>(
    () => [
      json(),
      theme,
      highlightStyle,
      EditorView.lineWrapping,
      EditorState.readOnly.of(true),
      selectAllKeymap,
    ],
    [theme, highlightStyle, selectAllKeymap]
  );

  return (
    <div
      className={cn(
        'rounded-md border border-border',
        fullPage ? 'relative flex-1 min-h-0 overflow-hidden' : 'overflow-hidden',
        className
      )}
      style={{ backgroundColor: colors.background, maxHeight }}
    >
      <CodeMirror
        value={text}
        className={fullPage ? 'absolute inset-0' : 'text-xs'}
        height={fullPage ? '100%' : 'auto'}
        extensions={extensions}
        editable={true}
        basicSetup={{
          lineNumbers: fullPage,
          highlightActiveLineGutter: false,
          highlightActiveLine: false,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: false,
          bracketMatching: true,
          closeBrackets: false,
          autocompletion: false,
          searchKeymap: false,
        }}
      />
    </div>
  );
}