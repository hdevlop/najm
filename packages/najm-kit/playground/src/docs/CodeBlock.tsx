import React from 'react';

interface CodeBlockProps {
  code: string;
  lang?: string;
  bare?: boolean;
}

export function CodeBlock({ code, lang = 'tsx', bare = false }: CodeBlockProps) {
  const pre = (
    <pre className="bg-slate-950 text-sm p-4 overflow-x-auto font-mono leading-relaxed whitespace-pre h-full">
      <code className="text-slate-300">
        {highlightSyntax(code, lang)}
      </code>
    </pre>
  );

  if (bare) return pre;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800/80 text-sm">
      <div className="flex items-center px-4 py-2 bg-slate-900/80 border-b border-slate-800/60">
        <span className="text-[11px] font-mono text-slate-500">{lang}</span>
      </div>
      {pre}
    </div>
  );
}

function highlightSyntax(code: string, lang: string): React.ReactNode[] {
  if (lang === 'bash') {
    return [<span key="bash" className="text-amber-300">{code}</span>];
  }

  const parts: React.ReactNode[] = [];
  const lines = code.split('\n');

  for (let li = 0; li < lines.length; li++) {
    if (li > 0) parts.push('\n');
    const line = lines[li];
    let remaining = line;
    let keyIdx = 0;

    while (remaining.length > 0) {
      let matched = false;

      const stringMatch = remaining.match(/^(["'`])/);
      if (stringMatch) {
        const quote = stringMatch[1];
        const endIdx = remaining.indexOf(quote, 1);
        const str = endIdx === -1 ? remaining : remaining.slice(0, endIdx + 1);
        parts.push(<span key={`${li}-${keyIdx++}`} className="text-emerald-400">{str}</span>);
        remaining = remaining.slice(str.length);
        matched = true;
        continue;
      }

      const commentMatch = remaining.match(/^(\/\/.*$)/);
      if (commentMatch) {
        parts.push(<span key={`${li}-${keyIdx++}`} className="text-slate-500 italic">{commentMatch[1]}</span>);
        remaining = '';
        matched = true;
        continue;
      }

      const keywordMatch = remaining.match(/^(import|from|export|default|const|let|var|function|return|if|else|type|interface|extends|implements|new|typeof|as|await|async|class|throw|try|catch|finally)(?=[^a-zA-Z0-9_])/);
      if (keywordMatch) {
        const kw = keywordMatch[1];
        parts.push(<span key={`${li}-${keyIdx++}`} className="text-sky-400">{kw}</span>);
        remaining = remaining.slice(kw.length);
        matched = true;
        continue;
      }

      const jsxTagMatch = remaining.match(/^(<\/?)([A-Z][a-zA-Z0-9]*)/);
      if (jsxTagMatch) {
        parts.push(<span key={`${li}-${keyIdx++}`} className="text-slate-400">{jsxTagMatch[1]}</span>);
        parts.push(<span key={`${li}-${keyIdx++}`} className="text-amber-300">{jsxTagMatch[2]}</span>);
        remaining = remaining.slice(jsxTagMatch[0].length);
        matched = true;
        continue;
      }

      const numberMatch = remaining.match(/^(\d+\.?\d*)/);
      if (numberMatch) {
        parts.push(<span key={`${li}-${keyIdx++}`} className="text-pink-400">{numberMatch[1]}</span>);
        remaining = remaining.slice(numberMatch[1].length);
        matched = true;
        continue;
      }

      const punctMatch = remaining.match(/^([{}()[\];.,:=<>+\-*/!?&|@])/);
      if (punctMatch) {
        parts.push(<span key={`${li}-${keyIdx++}`} className="text-slate-500">{punctMatch[1]}</span>);
        remaining = remaining.slice(1);
        matched = true;
        continue;
      }

      if (!matched) {
        const nextSpecial = remaining.search(/["'`/]|$|import|from|export|const|function|return|\d|[{}()[\];.,:=<>+\-*/!?&|@]/);
        const safeNext = nextSpecial > 0 ? nextSpecial : 1;
        const chunk = remaining.slice(0, safeNext);
        parts.push(chunk);
        remaining = remaining.slice(chunk.length);
      }
    }
  }

  return parts;
}
