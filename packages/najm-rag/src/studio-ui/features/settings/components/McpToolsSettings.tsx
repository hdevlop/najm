import React, { useEffect, useMemo, useState } from 'react';
import { Package, Wrench } from 'lucide-react';
import { Badge } from 'najm-kit';
import { JsonEditor as StudioJsonEditor } from 'najm-kit/json';
import type { LiveRoutingSettings, JsonViewColors } from '@/features/logs/types';
import { defaultJsonViewColors } from '@/features/routing-semantics/utils/json-view-presets';

interface McpToolsSettingsProps {
  settings: LiveRoutingSettings;
  saving: boolean;
  onSaveDependencies: (dependencies: Record<string, string[]>) => Promise<void> | void;
  colors?: JsonViewColors;
}

export function McpToolsSettings({
  settings,
  saving,
  onSaveDependencies,
  colors = defaultJsonViewColors,
}: McpToolsSettingsProps) {
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sourceText = useMemo(
    () => JSON.stringify(settings.dependencies ?? {}, null, 2),
    [settings.dependencies]
  );

  useEffect(() => {
    setJsonText(sourceText);
    setParseError(null);
    setSaveError(null);
  }, [sourceText]);

  const dirty = jsonText !== sourceText;

  const dependencyCount = useMemo(
    () => Object.values(settings.dependencies ?? {}).reduce((sum, deps) => sum + deps.length, 0),
    [settings.dependencies],
  );

  const handleChange = (value: string) => {
    setJsonText(value);
    setSaveError(null);
    try {
      JSON.parse(value);
      setParseError(null);
    } catch (e: any) {
      setParseError(e.message);
    }
  };

  const parseDependencies = (text: string): Record<string, string[]> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON syntax.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected an object like { "tool": ["dependency"] }.');
    }

    const normalized: Record<string, string[]> = {};
    for (const [toolName, deps] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(deps)) {
        throw new Error(`"${toolName}" must be an array of tool names.`);
      }
      normalized[toolName] = [...new Set(
        deps
          .filter((dep): dep is string => typeof dep === 'string')
          .map((dep) => dep.trim())
          .filter((dep) => dep && dep !== toolName),
      )];
    }

    return normalized;
  };

  const handleSave = async () => {
    if (!dirty || parseError || saving) return;
    try {
      const dependencies = parseDependencies(jsonText);
      setSaveError(null);
      await onSaveDependencies(dependencies);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Invalid dependencies JSON.');
    }
  };

  const handleReset = () => {
    setJsonText(sourceText);
    setParseError(null);
    setSaveError(null);
  };

  const handleCancel = () => {
    setJsonText(sourceText);
    setParseError(null);
    setSaveError(null);
  };

  const lines = jsonText.split('\n');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-brand/10 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-txt-primary">MCP Tools</h2>
            <p className="truncate text-sm text-txt-muted">Dependency routing JSON</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1.5 font-mono text-xs">
          <Package className="h-3 w-3" />
          {dependencyCount} deps
        </Badge>
      </div>

      <div className="rounded-lg border border-border bg-card/70 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-brand" />
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-txt-secondary">
              Dependencies JSON
            </h3>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            tool -&gt; deps
          </Badge>
        </div>
        <p className="text-xs leading-5 text-txt-muted">
          Configure MCP tool dependencies as a JSON map. Example: {"{"}"orders_create": ["products_list"]{"}"}.
        </p>
        <div className="h-80 flex flex-col">
          <StudioJsonEditor
            value={jsonText}
            onChange={handleChange}
            onSave={handleSave}
            onReset={handleReset}
            onCancel={handleCancel}
            dirty={dirty}
            parseError={parseError}
            saveError={saveError}
            saveSuccess={null}
            loading={false}
            saving={saving}
            colors={colors}
            lineCount={lines.length}
            itemCount={dependencyCount}
            itemLabel="dependencies"
            loadingLabel="Loading..."
            readOnly={false}
          />
        </div>
      </div>
    </div>
  );
}
