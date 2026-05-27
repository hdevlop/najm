import React, { createContext, useContext, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "../ui/button";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import { PrefixProvider } from "./PrefixContext";
import { cn } from "../../lib/cn";

interface DynamicArrayProps {
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

  if (fields.length === 0) {
    return (
      <button type="button" onClick={handleAdd} className="w-full text-center py-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
        <p className="text-sm text-muted-foreground mb-2">{emptyLabel}</p>
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Plus className="h-4 w-4" />
          <span>{addLabel}</span>
        </div>
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {fields.map((field, index) => {
        const isCollapsed = collapsedItems.has(index);
        return (
          <div key={field.id} className="border border-dashed rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <div className={cn("flex items-center gap-2 flex-1", collapsible && "cursor-pointer select-none")} onClick={() => collapsible && toggleCollapse(index)}>
                {collapsible && <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", !isCollapsed && "rotate-180")} />}
                <h3 className="text-md font-semibold text-tertiary">{renderTitle(field, index)}</h3>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(index)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className={cn("transition-all duration-200 ease-in-out overflow-hidden", isCollapsed ? "max-h-0 opacity-0" : "max-h-[5000px] opacity-100")}>
              <PrefixProvider prefix={`${name}.${index}`}>{children}</PrefixProvider>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={handleAdd} className="self-start p-0 bg-transparent border-0 cursor-pointer">
        <Plus className="h-8 w-8 mr-2 bg-foreground text-white rounded-full p-1 opacity-50 hover:opacity-100" />
      </button>
    </div>
  );
};

export default DynamicArray;
