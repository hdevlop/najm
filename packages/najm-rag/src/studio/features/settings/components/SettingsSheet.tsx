import React, { useState, useEffect } from 'react';
import { Radio, Database, Wrench, Palette } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from 'najm-ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from 'najm-ui';
import { ScrollArea } from 'najm-ui';
import { SettingsView } from './SettingsView';
import { IndexSettings } from './IndexSettings';
import { McpToolsSettings } from './McpToolsSettings';
import { JsonColorsSettings } from './JsonColorsSettings';
import { useApiClient } from '@/lib/api';
import type { LiveRoutingSettings, IndexSettings as IndexSettingsType, JsonViewColors } from '@/features/logs/types';

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChange?: (settings: LiveRoutingSettings) => void;
  onDependenciesChange?: () => void;
  jsonViewColors?: JsonViewColors;
  onJsonViewColorsChange?: (colors: JsonViewColors) => void;
}

export function SettingsSheet({ open, onOpenChange, onSettingsChange, onDependenciesChange, jsonViewColors, onJsonViewColorsChange }: SettingsSheetProps) {
  const apiClient = useApiClient();
  const [routingSettings, setRoutingSettings] = useState<LiveRoutingSettings | null>(null);
  const [indexSettings, setIndexSettings] = useState<IndexSettingsType | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) loadSettings();
  }, [open]);

  const loadSettings = async () => {
    try {
      const [routing, index] = await Promise.all([
        apiClient.get<LiveRoutingSettings>('/settings'),
        apiClient.get<IndexSettingsType>('/settings/index'),
      ]);
      setRoutingSettings(routing);
      onSettingsChange?.(routing);
      setIndexSettings(index);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSaveDependencies = async (dependencies: Record<string, string[]>) => {
    await handleSaveRouting({ dependencies });
    onDependenciesChange?.();
  };

  const handleReindexAllTools = async () => {
    await apiClient.post('/tools/reindex');
    await loadSettings();
  };

  const handleSaveAllowedLangs = async (allowedLangs: string[]) => {
    setSaving(true);
    try {
      const updated = await apiClient.patch<LiveRoutingSettings>('/settings', { allowedLangs });
      setRoutingSettings(updated);
      onSettingsChange?.(updated);
      onDependenciesChange?.();
      await loadSettings();
    } catch (err) {
      console.error('Failed to save allowed languages:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRouting = async (settings: Partial<LiveRoutingSettings>) => {
    setSaving(true);
    try {
      const updated = await apiClient.patch<LiveRoutingSettings>('/settings', settings);
      setRoutingSettings(updated);
      onSettingsChange?.(updated);
      await loadSettings();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        portalClassName="rs-studio"
        className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-sidebar p-0 text-txt-primary"
        style={{ width: 'min(520px, 90vw)', maxWidth: '520px' }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <SheetTitle className="text-sm font-semibold text-txt-primary">Settings</SheetTitle>
        </div>
        <Tabs defaultValue="routing" className="min-h-0 flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 shrink-0 border-b border-border/60">
            <TabsList className="h-10 w-full gap-1 rounded-md bg-bg p-1 text-txt-muted">
              <TabsTrigger
                value="routing"
                className="h-8 flex-1 gap-2 rounded data-[state=active]:bg-card data-[state=active]:text-txt-primary data-[state=active]:shadow-none"
              >
                <Radio className="h-3.5 w-3.5" />
                Routing
              </TabsTrigger>
              <TabsTrigger
                value="json-colors"
                className="h-8 flex-1 gap-2 rounded data-[state=active]:bg-card data-[state=active]:text-txt-primary data-[state=active]:shadow-none"
              >
                <Palette className="h-3.5 w-3.5" />
                Colors
              </TabsTrigger>
              <TabsTrigger
                value="index"
                className="h-8 flex-1 gap-2 rounded data-[state=active]:bg-card data-[state=active]:text-txt-primary data-[state=active]:shadow-none"
              >
                <Database className="h-3.5 w-3.5" />
                Index
              </TabsTrigger>
              <TabsTrigger
                value="mcp-tools"
                className="h-8 flex-1 gap-2 rounded data-[state=active]:bg-card data-[state=active]:text-txt-primary data-[state=active]:shadow-none"
              >
                <Wrench className="h-3.5 w-3.5" />
                MCP Tools
              </TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <TabsContent value="routing" className="mt-0 p-5">
              {routingSettings ? (
                <SettingsView settings={routingSettings} onSave={handleSaveRouting} saving={saving} embedded />
              ) : (
                <div className="text-sm text-txt-muted">Loading…</div>
              )}
            </TabsContent>
            <TabsContent value="json-colors" className="mt-0 p-5">
              {jsonViewColors && onJsonViewColorsChange ? (
                <JsonColorsSettings
                  colors={jsonViewColors}
                  onColorsChange={onJsonViewColorsChange}
                />
              ) : (
                <div className="text-sm text-txt-muted">Loading…</div>
              )}
            </TabsContent>
            <TabsContent value="index" className="mt-0 p-5">
              {indexSettings ? (
                <IndexSettings
                  settings={indexSettings}
                  onReindexAll={handleReindexAllTools}
                  onSaveAllowedLangs={handleSaveAllowedLangs}
                  saving={saving}
                />
              ) : (
                <div className="text-sm text-txt-muted">Loading…</div>
              )}
            </TabsContent>
            <TabsContent value="mcp-tools" className="mt-0 p-5">
              {routingSettings ? (
                <McpToolsSettings
                  settings={routingSettings}
                  saving={saving}
                  onSaveDependencies={handleSaveDependencies}
                  colors={jsonViewColors}
                />
              ) : (
                <div className="text-sm text-txt-muted">Loading…</div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
