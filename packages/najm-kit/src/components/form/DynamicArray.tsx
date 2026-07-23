import React, { createContext, useContext, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "../Button";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import { PrefixProvider } from "./PrefixContext";
import { cn } from "../../lib/cn";

export interface DynamicArrayProps {
  name: string;
  children: React.ReactNode;
  title?: string | ((data: any, index: number) => string);
  onAdd?: (append: (value: any) => void, replace: (value: any[]) => void) => void;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  addLabel?: string;
  emptyLabel?: string;
}

export type RepeatingFieldsProps = DynamicArrayProps;

const DynamicArray = ({ name, children, title, onAdd, className, collapsible = true, defaultCollapsed = false, addLabel = "Click to add item", emptyLabel = "No items added yet." }: DynamicArrayProps) => {
  const { control } = useFormContext();
  const { fields, append, remove, replace } = useFieldArray({ control, name });
  const [collapsedItems, setCollapsedItems] = useState<Set<number>>(defaultCollapsed ? new Set(fields.map((_, idx) => idx)) : new Set());

  const handleAdd = () => onAdd ? onAdd(append, replace) : append({});

  const toggleCollapse = (index: number) =>
    setCollapsedItems((prev) => { const next = new Set(prev); next.has(index) ? next.delete(index) : next.add(index); return next; });

  const handleRemove = (index: number) => {
    remove(index);
    setCollapsedItems((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i < index) next.add(i); if (i > index) next.add(i - 1); });
      return next;
    });
  };

  const renderTitle = (field: any, index: number) =>
    typeof title === "function" ? title(field, index) : `${title || "Item"} #${index + 1}`;

  const addButton = (
    <Button
      type="button"
      variant="outline"
      onClick={handleAdd}
      className="w-full justify-center border-dashed border-border bg-background/40 text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
    >
      <Plus className="h-4 w-4" />
      <span>{addLabel}</span>
    </Button>
  );

  if (fields.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <button
          type="button"
          onClick={handleAdd}
          className="flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background/40 px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
            <Plus className="h-5 w-5" />
          </span>
          <span className="space-y-1">
            <span className="block text-sm font-medium text-foreground">{addLabel}</span>
            <span className="block text-xs text-muted-foreground">{emptyLabel}</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {fields.map((field, index) => {
        const isCollapsed = collapsedItems.has(index);
        return (
          <div key={field.id} className="rounded-lg border border-border bg-background/40 p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className={cn("flex min-w-0 flex-1 items-center gap-2", collapsible && "cursor-pointer select-none")} onClick={() => collapsible && toggleCollapse(index)}>
                {collapsible && <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", !isCollapsed && "rotate-180")} />}
                <h3 className="truncate text-sm font-semibold text-foreground">{renderTitle(field, index)}</h3>
              </div>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${renderTitle(field, index)}`} onClick={() => handleRemove(index)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className={cn("transition-all duration-200 ease-in-out overflow-hidden", isCollapsed ? "max-h-0 opacity-0" : "max-h-[5000px] opacity-100")}>
              <PrefixProvider prefix={`${name}.${index}`}>{children}</PrefixProvider>
            </div>
          </div>
        );
      })}
      {addButton}
    </div>
  );
};

export const RepeatingFields = DynamicArray;
export default DynamicArray;
