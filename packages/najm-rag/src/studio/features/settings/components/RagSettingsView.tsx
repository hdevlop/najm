'use client';

import React, { useState } from 'react';
import { Button } from 'najm-ui';
import { Settings } from 'lucide-react';
import { SettingsSheet } from './SettingsSheet';
import type { RagSettingsViewProps } from '../types';

export function RagSettingsView({ defaultOpen = false, trigger }: RagSettingsViewProps = {}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rs-studio">
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Settings className="h-3.5 w-3.5 mr-2" />
          Settings
        </Button>
      )}
      <SettingsSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
