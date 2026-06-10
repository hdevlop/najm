import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from "../../lib/cn";

interface InspectorSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function NInspectorSheet({ open, onClose, title, children }: InspectorSheetProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[380px] flex flex-col p-0 border-l border-border">
        <div className="flex items-center justify-between h-14 px-5 border-b border-border shrink-0">
          <SheetTitle className="text-sm font-semibold text-foreground">{title}</SheetTitle>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ScrollArea className="flex-1">{children}</ScrollArea>
      </SheetContent>
    </Sheet>
  );
}