import React from 'react';
import { SearchInput, Combobox } from 'najm-kit';

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
      <SearchInput
        className="min-w-0 flex-1 sm:min-w-[440px]"
        placeholder="Search tools…"
        value={search}
        onChange={onSearchChange}
      />
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
