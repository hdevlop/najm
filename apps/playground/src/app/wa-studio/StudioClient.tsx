'use client';

import { WhatsAppStudioProvider, WhatsAppStudio } from 'najm-whatsapp-studio';
import 'najm-whatsapp-studio/styles.css';

export default function StudioClient() {
  return (
    <WhatsAppStudioProvider
      apiBase="/api/wa-studio"
      basePath="/wa-studio"
      getAuthHeaders={() => ({})}
      onUnauthorized={() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/login?next=/wa-studio';
        }
      }}
    >
      <div className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden">
        <WhatsAppStudio />
      </div>
    </WhatsAppStudioProvider>
  );
}
