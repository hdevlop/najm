"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchResult {
  title: string;
  href: string;
  content: string;
}

interface SearchProps {
  docs: SearchResult[];
}

export function SearchDialog({ docs }: SearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const results = query.length > 1
    ? docs.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query.toLowerCase()) ||
          doc.content.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSelect = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  }, [router]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        Search docs...
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-[50%] top-[20%] z-50 w-full max-w-lg translate-x-[-50%] rounded-lg border bg-background shadow-lg">
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search documentation..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2">
              {results.length === 0 && query.length > 1 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No results found.
                </p>
              )}
              {results.length === 0 && query.length <= 1 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Type to search...
                </p>
              )}
              {results.map((result) => (
                <button
                  key={result.href}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => handleSelect(result.href)}
                >
                  <FileText className="h-4 w-4" />
                  <span>{result.title}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
