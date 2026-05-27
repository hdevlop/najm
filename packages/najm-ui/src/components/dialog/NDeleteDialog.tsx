import React from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/cn";
import { AlertTriangle } from "lucide-react";

export interface NDeleteDialogContentProps {
  itemName: string;
  itemType?: string;
  icon?: React.ComponentType<{ className?: string }>;
  warningText?: string;
  className?: string;
}

export function NDeleteDialogContent({
  itemName,
  itemType,
  icon: Icon,
  warningText = "This action cannot be undone.",
  className,
}: NDeleteDialogContentProps) {
  const IconComponent = Icon || AlertTriangle;

  return (
    <form id="najm-delete-form" onSubmit={(e) => e.preventDefault()}>
      <div className={cn("flex flex-col items-center gap-4 py-4", className)}>
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30">
          <IconComponent className="h-10 w-10 text-red-500" />
        </div>
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-md text-muted-foreground mb-2">
            Are you sure you want to delete <strong>{itemName}</strong>
            {itemType ? <> ({itemType})</> : null}?
          </p>
          <p className="text-md text-muted-foreground">{warningText}</p>
        </div>
      </div>
    </form>
  );
}
