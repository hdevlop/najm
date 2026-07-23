'use client';

import { type CSSProperties } from 'react';
import { AiSettingsForm } from './AiSettingsForm';
import { useAiSettings } from '../hooks/useAiSettings';
import { joinApiPath } from '../lib/cn';
import type { ChatbotTheme, I18nFn } from '../types';

export interface AiSettingsPanelProps {
  settingsApiPath?: string;
  testApiPath?: string;
  theme?: ChatbotTheme;
  i18n?: I18nFn;
  className?: string;
  style?: CSSProperties;
}

export function AiSettingsPanel({
  settingsApiPath = '/ai-settings',
  testApiPath,
  theme,
  i18n,
  className,
  style,
}: AiSettingsPanelProps) {
  const settingsApi = useAiSettings({ settingsApiPath });
  const t: I18nFn = i18n ?? ((key) => key);
  const cssVars = {
    '--ncb-primary': theme?.primary ?? '#2563eb',
    '--ncb-radius': theme?.radius ?? '8px',
    '--ncb-accent': theme?.accent ?? theme?.primary ?? '#2563eb',
    '--ncb-code-bg': theme?.codeBg ?? '#0b1020',
    ...style,
  } as CSSProperties;

  return (
    <div className={className} style={cssVars}>
      <AiSettingsForm
        settingsApi={settingsApi}
        testApiPath={testApiPath ?? joinApiPath(settingsApiPath, 'test')}
        t={t}
      />
    </div>
  );
}
