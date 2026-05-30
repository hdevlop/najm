import React from 'react';
import { Search } from 'lucide-react';
import { Input, Combobox } from 'najm-ui';

interface ToolFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  groupFilter: string;
  onGroupFilterChange: (val: string) => void;
  confirmationFilter: string;
  onConfirmationFilterChange: (val: string) => void;
  toolGroups: Array<{ value: string; label: string; total: number }>;
  confirmationOptions: Array<{ value: string; label: string; total: number }>;
}

export function ToolFilters({
  search,
  onSearchChange,
  groupFilter,
  onGroupFilterChange,
  confirmationFilter,
  onConfirmationFilterChange,
  toolGroups,
  confirmationOptions,
}: ToolFiltersProps) {
  return (
    <div className="grid gap-2 sm:flex sm:items-center">
      <div className="relative min-w-0 flex-1 sm:min-w-[440px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
        <Input
          placeholder="Search tools…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 text-sm bg-card h-10"
        />
      </div>
      {toolGroups.length > 1 && (
        <Combobox
          options={[
            { value: '', label: 'All groups' },
            ...toolGroups.map((group) => ({
              value: group.value,
              label: `${group.label} (${group.total})`,
            })),
          ]}
          value={groupFilter}
          onChange={onGroupFilterChange}
          placeholder="All groups"
          className="w-full sm:w-52 sm:shrink-0"
        />
      )}
      {confirmationOptions.length > 1 && (
        <Combobox
          options={[
            { value: '', label: 'All confirmations' },
            ...confirmationOptions.map((option) => ({
              value: option.value,
              label: `${option.label} (${option.total})`,
            })),
          ]}
          value={confirmationFilter}
          onChange={onConfirmationFilterChange}
          placeholder="All confirmations"
          className="w-full sm:w-52 sm:shrink-0"
        />
      )}
    </div>
  );
}
