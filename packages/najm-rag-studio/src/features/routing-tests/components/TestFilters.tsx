import React from 'react';
import { Search } from 'lucide-react';
import { Input, Combobox } from 'najm-ui';

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
      <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
        <Input
          placeholder="Search test name..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="pl-9 text-sm bg-card h-10"
        />
      </div>
      <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
        <Input
          placeholder="Search query..."
          value={querySearch}
          onChange={(e) => onQuerySearchChange(e.target.value)}
          className="pl-9 text-sm bg-card h-10"
        />
      </div>
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
