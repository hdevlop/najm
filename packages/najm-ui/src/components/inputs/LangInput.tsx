import React from "react";
import { cn } from "../../lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Globe } from "lucide-react";
import type { LangInputProps } from "./types";

function resolveIcon(icon: string | React.ComponentType<{ className?: string }> | undefined): React.ReactNode {
  if (!icon) return null;
  if (typeof icon === "string") return <span className="text-base leading-none">{icon}</span>;
  const Icon = icon;
  return <Icon className="h-4 w-4" />;
}

export function LangInput({
  value,
  onChange,
  items,
  disabled = false,
  className,
}: LangInputProps) {
  const selected = items.find((i) => i.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} className={cn("outline-none", className)}>
        <div className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-accent transition-colors">
          {selected ? (
            <>
              {resolveIcon(selected.icon)}
              <span className="text-sm">{selected.label}</span>
            </>
          ) : (
            <Globe className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              value === item.value && "bg-primary text-primary-foreground"
            )}
          >
            {resolveIcon(item.icon)}
            <span>{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
