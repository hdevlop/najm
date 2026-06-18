import { RotateCcw } from 'lucide-react';
import type { JsonViewColors } from '@/features/routing-tools/types';
import { defaultJsonViewColors, colorPresets } from '@/features/routing-semantics/utils/json-view-presets';
import { Button } from 'najm-kit';

interface JsonColorsSettingsProps {
  colors: JsonViewColors;
  onColorsChange: (colors: JsonViewColors) => void;
}

export function JsonColorsSettings({ colors, onColorsChange }: JsonColorsSettingsProps) {
  const handleColorChange = (key: keyof JsonViewColors, value: string) => {
    onColorsChange({ ...colors, [key]: value });
  };
  const handleColorReset = (key: keyof JsonViewColors) => {
    onColorsChange({ ...colors, [key]: defaultJsonViewColors[key] });
  };
  const handleResetAll = () => {
    onColorsChange({ ...defaultJsonViewColors });
  };

  const colorKeys: { key: keyof JsonViewColors; label: string }[] = [
    { key: 'toolName', label: 'Tool Names' },
    { key: 'langCode', label: 'Language Codes' },
    { key: 'phrase', label: 'Phrases' },
    { key: 'bracket', label: 'Brackets' },
    { key: 'key', label: 'Keys' },
    { key: 'string', label: 'Strings' },
    { key: 'number', label: 'Numbers' },
    { key: 'background', label: 'Background' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">JSON View Colors</h3>
          <p className="text-xs text-txt-muted">Customize the Semantics JSON view colors</p>
        </div>
        <Button  variant="ghost" onClick={handleResetAll}>Reset All</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(colorPresets).map(([name, preset]) => (
          <button key={name} onClick={() => onColorsChange(preset)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:bg-bg transition-colors">
            <div className="flex -space-x-0.5">
              <div className="h-2.5 w-2.5 rounded-full border border-white/50" style={{ backgroundColor: preset.toolName }} />
              <div className="h-2.5 w-2.5 rounded-full border border-white/50" style={{ backgroundColor: preset.langCode }} />
              <div className="h-2.5 w-2.5 rounded-full border border-white/50" style={{ backgroundColor: preset.phrase }} />
            </div>
            <span className="capitalize">{name}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg p-3 font-mono text-xs leading-relaxed border border-border"
           style={{ backgroundColor: colors.background }}>
        <span style={{ color: colors.bracket }}>{'{'}</span>
        <br />
        <span className="ml-4" style={{ color: colors.toolName }}>"auth_login"</span>
        <span style={{ color: colors.bracket }}>{': {'}</span>
        <br />
        <span className="ml-8" style={{ color: colors.langCode }}>"en"</span>
        <span style={{ color: colors.bracket }}>{': ['}</span>
        <br />
        <span className="ml-12" style={{ color: colors.phrase }}>"sign in"</span>
        <span style={{ color: colors.bracket }}>{','}</span>
        <br />
        <span className="ml-12" style={{ color: colors.phrase }}>"log in"</span>
        <br />
        <span className="ml-8" style={{ color: colors.bracket }}>{']'}</span>
        <br />
        <span className="ml-4" style={{ color: colors.bracket }}>{'}'}</span>
        <br />
        <span style={{ color: colors.bracket }}>{'}'}</span>
      </div>

      <div className="space-y-3">
        {colorKeys.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium min-w-[110px]">{label}</span>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded border border-border cursor-pointer" style={{ backgroundColor: colors[key] }}>
                <input type="color" value={colors[key]}
                  onChange={e => handleColorChange(key, e.target.value)}
                  className="opacity-0 w-full h-full cursor-pointer" />
              </div>
              <span className="text-[10px] font-mono text-txt-muted w-16">{colors[key]}</span>
              <button onClick={() => handleColorReset(key)} title="Reset to default"
                className="p-1 hover:bg-bg rounded">
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}