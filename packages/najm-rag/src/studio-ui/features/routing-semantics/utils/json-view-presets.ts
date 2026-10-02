import type { JsonViewColors } from '@/features/routing-tools/types';

export const defaultJsonViewColors: JsonViewColors = {
  toolName: '#10b981',
  langCode: '#f59e0b',
  phrase: '#06b6d4',
  bracket: '#9ca3af',
  key: '#a78bfa',
  string: '#34d399',
  number: '#f472b6',
  background: '#1f2937',
};

export const colorPresets: Record<string, JsonViewColors> = {
  default: { ...defaultJsonViewColors },
  ocean: { toolName: '#0ea5e9', langCode: '#38bdf8', phrase: '#67e8f9', bracket: '#64748b', key: '#818cf8', string: '#5eead4', number: '#f0abfc', background: '#0f172a' },
  sunset: { toolName: '#f97316', langCode: '#fb923c', phrase: '#fbbf24', bracket: '#78716c', key: '#e879f9', string: '#fca5a5', number: '#c084fc', background: '#1c1917' },
  forest: { toolName: '#22c55e', langCode: '#84cc16', phrase: '#a3e635', bracket: '#57534e', key: '#4ade80', string: '#86efac', number: '#fcd34d', background: '#1a2e05' },
  monokai: { toolName: '#f92672', langCode: '#fd971f', phrase: '#e6db74', bracket: '#75715e', key: '#ae81ff', string: '#a6e22e', number: '#ae81ff', background: '#272822' },
};