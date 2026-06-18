import { Search } from 'lucide-react';
import { Input, Combobox } from 'najm-kit';

interface SemanticFiltersProps {
  searchQuery: string;
  toolGroupFilter: string;
  toolFilter: string;
  langFilter: string;
  toolGroupOptions: Array<{ value: string; label: string }>;
  availableTools: string[];
  langGroupOptions: Array<{ value: string; label: string }>;
  showToolGroupFilter?: boolean;
  showToolFilter?: boolean;
  showLangFilter?: boolean;
  onSearchChange: (val: string) => void;
  onToolGroupFilterChange: (val: string) => void;
  onToolFilterChange: (val: string) => void;
  onLangFilterChange: (val: string) => void;
}

export function SemanticFilters({
  searchQuery,
  toolGroupFilter,
  toolFilter,
  langFilter,
  toolGroupOptions,
  availableTools,
  langGroupOptions,
  showToolGroupFilter = true,
  showToolFilter = true,
  showLangFilter = true,
  onSearchChange,
  onToolGroupFilterChange,
  onToolFilterChange,
  onLangFilterChange,
}: SemanticFiltersProps) {
  return (
    <div className="grid gap-2 sm:flex sm:items-center">
      <div className="relative min-w-0 flex-1 sm:min-w-[440px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-txt-muted" />
        <Input
          placeholder="Search phrases..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 text-sm bg-card h-10"
        />
      </div>
      {showToolGroupFilter && toolGroupOptions.length > 1 && (
        <Combobox
          options={toolGroupOptions}
          value={toolGroupFilter}
          onChange={onToolGroupFilterChange}
          placeholder="All groups"
          className="w-full sm:w-52 sm:shrink-0"
        />
      )}
      {showToolFilter && availableTools.length > 0 && (
        <Combobox
          options={availableTools.map((t) => ({ value: t, label: t }))}
          value={toolFilter}
          onChange={onToolFilterChange}
          placeholder="All tools"
          allowFreeText
          className="w-full sm:w-56 sm:shrink-0"
        />
      )}
      {showLangFilter && langGroupOptions.length > 1 && (
        <Combobox
          options={langGroupOptions}
          value={langFilter}
          onChange={onLangFilterChange}
          placeholder="All languages"
          className="w-full sm:w-44 sm:shrink-0"
        />
      )}
    </div>
  );
}
