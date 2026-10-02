import { RotateCcw } from 'lucide-react';
import type { JsonViewColors } from '@/features/routing-tools/types';
import { defaultJsonViewColors, colorPresets } from '@/features/routing-semantics/utils/json-view-presets';
import { Button, ColorPickerInput } from 'najm-kit';

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
          <Button key={name} variant="outline" size="xs" onClick={() => onColorsChange(preset)} className="gap-1.5 px-3">
            <div className="flex -space-x-0.5">
              <div className="h-2.5 w-2.5 rounded-full border border-white/50" style={{ backgroundColor: preset.toolName }} />
              <div className="h-2.5 w-2.5 rounded-full border border-white/50" style={{ backgroundColor: preset.langCode }} />
              <div className="h-2.5 w-2.5 rounded-full border border-white/50" style={{ backgroundColor: preset.phrase }} />
            </div>
            <span className="capitalize">{name}</span>
          </Button>
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
              <ColorPickerInput
                mode="popover"
                output="hex"
                hideSwatches
                value={colors[key]}
                onChange={(value) => handleColorChange(key, value)}
                className="w-36 gap-2 px-2 py-1 [&>span:first-child]:size-5"
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleColorReset(key)}
                title="Reset to default"
                aria-label={`Reset ${label} color`}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}