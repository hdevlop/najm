"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  highlightedCode?: string;
}

export function CodeBlock({
  code,
  language,
  filename,
  highlightedCode,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-lg border bg-red-950">
      {(filename || language) && (
        <div className="flex items-center justify-between border-b bg-zinc-900 px-4 py-2 text-sm">
          <span className="text-zinc-200">{filename || language}</span>
        </div>
      )}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 text-zinc-400 hover:text-zinc-100"
          onClick={copyToClipboard}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        {highlightedCode ? (
          <div
            className={cn(
              "overflow-x-auto p-4 text-sm",
              "[&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!bg-transparent"
            )}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        ) : (
          <pre className="overflow-x-auto p-4 text-sm">
            <code className="text-red-600">{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
