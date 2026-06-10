import React from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem as CmdItem,
  CommandShortcut,
} from "../ui/command";
import { cn } from "../../lib/cn";
import type { NCommandPaletteProps } from "./types";

export function NCommandPalette({
  commands,
  open,
  onOpenChange,
  placeholder = "Search...",
  emptyMessage = "No results found.",
  className,
}: NCommandPaletteProps) {
  const groups = new Map<string, typeof commands>();
  for (const cmd of commands) {
    const group = cmd.group || "";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(cmd);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={placeholder} />
      <CommandList className={className}>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        {[...groups.entries()].map(([group, items]) => (
          <CommandGroup key={group || "default"} heading={group || undefined}>
            {items.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <CmdItem
                  key={cmd.id}
                  onSelect={cmd.onSelect}
                  className="cursor-pointer"
                >
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  <span>{cmd.label}</span>
                  {cmd.description && (
                    <span className="ml-2 text-xs text-muted-foreground">{cmd.description}</span>
                  )}
                  {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
                </CmdItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
