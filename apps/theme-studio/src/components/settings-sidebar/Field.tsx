import type { ReactNode } from "react";
import { Label } from "najm-kit";

interface FieldProps {
  label: string;
  children: ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1 py-1">
      <Label className="flex-col items-start gap-1 text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
