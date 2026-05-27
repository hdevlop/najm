'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import hljs from 'highlight.js/lib/common';
import { Check, Copy } from 'lucide-react';
import { cn } from '../lib/cn';

interface MarkdownMessageProps {
  text: string;
}

const HLJS_STYLE_ID = 'ncb-hljs-theme';
const HLJS_CSS = `
.ncb-code .hljs-comment,.ncb-code .hljs-quote{color:#7f8ea3;font-style:italic}
.ncb-code .hljs-keyword,.ncb-code .hljs-selector-tag,.ncb-code .hljs-literal,.ncb-code .hljs-type{color:#c792ea}
.ncb-code .hljs-string,.ncb-code .hljs-doctag,.ncb-code .hljs-regexp{color:#a5e075}
.ncb-code .hljs-number,.ncb-code .hljs-built_in,.ncb-code .hljs-meta{color:#f78c6c}
.ncb-code .hljs-title,.ncb-code .hljs-section,.ncb-code .hljs-name,.ncb-code .hljs-selector-id,.ncb-code .hljs-selector-class{color:#82aaff}
.ncb-code .hljs-attr,.ncb-code .hljs-attribute,.ncb-code .hljs-variable,.ncb-code .hljs-template-variable{color:#ffcb6b}
.ncb-code .hljs-symbol,.ncb-code .hljs-bullet,.ncb-code .hljs-link{color:#89ddff}
.ncb-code .hljs-tag,.ncb-code .hljs-params{color:#ff6b9d}
.ncb-code .hljs-deletion{color:#ff5874}
.ncb-code .hljs-addition{color:#a5e075}
.ncb-code .hljs-emphasis{font-style:italic}
.ncb-code .hljs-strong{font-weight:700}
`;

function useHljsTheme() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(HLJS_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = HLJS_STYLE_ID;
    style.textContent = HLJS_CSS;
    document.head.appendChild(style);
  }, []);
}

function CodeBlock({ className, children }: { className?: string; children: unknown }) {
  useHljsTheme();
  const [copied, setCopied] = useState(false);
  const code = String(children ?? '').replace(/\n$/, '');
  const language = /language-(\w+)/.exec(className ?? '')?.[1];

  const html = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }, [code, language]);

  const copy = async () => {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="ncb-code relative my-3 overflow-hidden rounded-[var(--ncb-radius)] border border-zinc-800 text-zinc-100"
      style={{ background: 'var(--ncb-code-bg)' }}
    >
      {language && (
        <span className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          {language}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-zinc-200 transition hover:bg-white/20"
        title={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className={cn('max-h-72 overflow-auto px-3 pb-3 pr-11 text-xs leading-5', language ? 'pt-7' : 'pt-3')}>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

export function MarkdownMessage({ text }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="my-1">{children}</li>,
        a: ({ children, href }) => (
          <a className="font-medium text-[var(--ncb-primary)] underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        code: ({ inline, className, children }: any) => inline ? (
          <code className="rounded bg-[var(--ncb-primary)]/10 px-1 py-0.5 font-mono text-[0.9em] text-[var(--ncb-accent)]">{children}</code>
        ) : (
          <CodeBlock className={className} children={children} />
        ),
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className={cn('my-2 border-l-2 pl-3 text-zinc-600', 'dark:text-zinc-300')}>
            {children}
          </blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
