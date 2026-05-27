import React from 'react';
import { Search } from 'lucide-react';
import { Input } from "../ui/input";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchField({ value, onChange, placeholder = 'Search...', className }: SearchFieldProps) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 text-sm bg-card"
      />
    </div>
  );
}

export { SearchField as SearchInput };