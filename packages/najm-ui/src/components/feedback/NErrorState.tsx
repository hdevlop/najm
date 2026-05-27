import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/cn";

export interface NErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  icon?: React.ReactNode;
}

export function NErrorState({ title = "Something went wrong", message, onRetry, retryLabel = "Try again", className, icon }: NErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-8", className)}>
      <div className="text-destructive">{icon || <AlertTriangle className="h-10 w-10" />}</div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {message && <p className="text-muted-foreground text-sm mt-1">{message}</p>}
      </div>
      {onRetry && <Button variant="outline" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}
