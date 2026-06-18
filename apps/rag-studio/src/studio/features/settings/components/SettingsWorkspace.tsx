import React, { useState, useEffect } from 'react';
import { Radio, Database, Wrench } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from 'najm-kit';
import { SettingsView } from './SettingsView';
import { IndexSettings } from './IndexSettings';
import { McpToolsSettings } from './McpToolsSettings';
import { useApiClient } from '@/lib/api';
import type { LiveRoutingSettings, IndexSettings as IndexSettingsType } from '@/features/logs/types';

export function SettingsWorkspace() {
  const apiClient = useApiClient();
  const [activeTab, setActiveTab] = useState('routing');
  const [routingSettings, setRoutingSettings] = useState<LiveRoutingSettings | null>(null);
  const [indexSettings, setIndexSettings] = useState<IndexSettingsType | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [routing, index] = await Promise.all([
        apiClient.get<LiveRoutingSettings>('/settings'),
        apiClient.get<IndexSettingsType>('/settings/index'),
      ]);
      setRoutingSettings(routing);
      setIndexSettings(index);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSaveDependencies = async (dependencies: Record<string, string[]>) => {
    await handleSaveRouting({ dependencies });
  };

  const handleReindexAllTools = async () => {
    await apiClient.post('/tools/reindex');
    await loadSettings();
  };

  const handleSaveAllowedLangs = async (allowedLangs: string[]) => {
    await handleSaveRouting({ allowedLangs });
  };

  const handleSaveRouting = async (settings: Partial<LiveRoutingSettings>) => {
    setSaving(true);
    try {
      await apiClient.patch('/settings', settings);
      await loadSettings();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 flex-1 flex flex-col">
        <div className="px-5 pt-4 pb-2">
          <TabsList className="gap-1">
            <TabsTrigger value="routing" className="gap-2">
              <Radio className="h-3.5 w-3.5" />
              Live Routing
            </TabsTrigger>
            <TabsTrigger value="index" className="gap-2">
              <Database className="h-3.5 w-3.5" />
              Index
            </TabsTrigger>
            <TabsTrigger value="mcp-tools" className="gap-2">
              <Wrench className="h-3.5 w-3.5" />
              MCP Tools
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="routing" className="flex-1 overflow-hidden mt-0">
          {routingSettings && (
            <SettingsView
              settings={routingSettings}
              onSave={handleSaveRouting}
              saving={saving}
            />
          )}
        </TabsContent>
        <TabsContent value="index" className="flex-1 overflow-hidden mt-0">
          {indexSettings && (
            <IndexSettings
              settings={indexSettings}
              onReindexAll={handleReindexAllTools}
              onSaveAllowedLangs={handleSaveAllowedLangs}
              saving={saving}
            />
          )}
        </TabsContent>
        <TabsContent value="mcp-tools" className="flex-1 overflow-y-auto mt-0 p-5">
          {routingSettings && (
            <McpToolsSettings
              settings={routingSettings}
              saving={saving}
              onSaveDependencies={handleSaveDependencies}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
