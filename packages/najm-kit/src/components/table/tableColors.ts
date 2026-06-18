export const HEADER_COLORS = {
  primary: { bg: 'bg-primary/15',     text: '[&_th]:text-foreground',                                          row: 'hover:bg-primary/5'     },
  violet:  { bg: 'bg-violet-600/30',  text: '[&_th]:text-violet-800 dark:[&_th]:text-violet-300',           row: 'hover:bg-violet-500/5'  },
  blue:    { bg: 'bg-blue-600/30',    text: '[&_th]:text-blue-800   dark:[&_th]:text-blue-300',             row: 'hover:bg-blue-500/5'    },
  emerald: { bg: 'bg-emerald-600/30', text: '[&_th]:text-emerald-800 dark:[&_th]:text-emerald-400',        row: 'hover:bg-emerald-500/5' },
  amber:   { bg: 'bg-amber-500/30',   text: '[&_th]:text-amber-800   dark:[&_th]:text-amber-300',           row: 'hover:bg-amber-500/5'   },
  rose:    { bg: 'bg-rose-600/30',    text: '[&_th]:text-rose-800    dark:[&_th]:text-rose-300',            row: 'hover:bg-rose-500/5'    },
  slate:   { bg: 'bg-slate-700/60',   text: '[&_th]:text-slate-100   dark:[&_th]:text-slate-400',           row: 'hover:bg-slate-500/5'   },
} as const;

export type TableHeaderColor = keyof typeof HEADER_COLORS;

export const HEADER_HEX: Partial<Record<TableHeaderColor, string>> = {
  primary: '',
  violet:  '#7c3aed',
  blue:    '#2563eb',
  emerald: '#059669',
  amber:   '#f59e0b',
  rose:    '#e11d48',
  slate:   '#475569',
};
