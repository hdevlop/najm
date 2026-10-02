'use client';

import { RagStudioProvider, RagStudio } from 'najm-rag/studio';
import { AiSettingsPanel } from 'najm-chatbot/react';
import 'najm-rag/studio/styles.css';

export default function StudioClient() {
  return (
    <RagStudioProvider apiBase="/api/rag-studio" basePath="/rag-studio" chatSettingsPanel={AiSettingsPanel}>
      <div className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden">
        <RagStudio />
      </div>
    </RagStudioProvider>
  );
}
