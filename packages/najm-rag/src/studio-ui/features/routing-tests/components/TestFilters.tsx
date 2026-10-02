import React from 'react';
import { SearchInput, Combobox } from 'najm-kit';

interface TestFiltersProps {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  querySearch: string;
  onQuerySearchChange: (v: string) => void;
  toolFilter: string;
  onToolFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  availableTools: string[];
  statusOptions: Array<{ value: string; label: string }>;
  showToolFilter?: boolean;
  showStatusFilter?: boolean;
}

export function TestFilters({
  searchQuery,
  onSearchQueryChange,
  querySearch,
  onQuerySearchChange,
  toolFilter,
  onToolFilterChange,
  statusFilter,
  onStatusFilterChange,
  availableTools,
  statusOptions,
  showToolFilter = true,
  showStatusFilter = true,
}: TestFiltersProps) {
  return (
    <div className="grid gap-2 sm:flex sm:items-center">
      <SearchInput
        className="min-w-0 flex-1 sm:min-w-[220px]"
        placeholder="Search test name..."
        value={searchQuery}
        onChange={onSearchQueryChange}
      />
      <SearchInput
        className="min-w-0 flex-1 sm:min-w-[220px]"
        placeholder="Search query..."
        value={querySearch}
        onChange={onQuerySearchChange}
      />
      {showToolFilter && availableTools.length > 0 && (
        <Combobox
          options={availableTools.map((t) => ({ value: t, label: t }))}
          value={toolFilter}
          onChange={onToolFilterChange}
          placeholder="All tools"
          allowFreeText
          className="w-full sm:w-48 sm:shrink-0"
        />
      )}
      {showStatusFilter && (
        <Combobox
          options={statusOptions}
          value={statusFilter}
          onChange={onStatusFilterChange}
          placeholder="All results"
          className="w-full sm:w-40 sm:shrink-0"
        />
      )}
    </div>
  );
}
