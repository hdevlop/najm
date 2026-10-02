'use client';

import React from 'react';
import { KnowledgeWorkspace } from '..';
import type { KnowledgeView } from '@/shared/hooks/useWorkspace';

export interface RagKnowledgeViewProps {
  view?: KnowledgeView;
}

export function RagKnowledgeView({ view = 'documents' }: RagKnowledgeViewProps = {}) {
  return (
    <div className="rs-studio h-full w-full">
      <KnowledgeWorkspace view={view} />
    </div>
  );
}
