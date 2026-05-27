export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  buckets: string[];
  onSelectBucket: (b: string) => void;
  onSelectPanel: (p: string) => void;
}

export interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
}