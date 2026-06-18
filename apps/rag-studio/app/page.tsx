'use client';

import dynamic from 'next/dynamic';

// Client-only: the studio is a pure SPA (client router, localStorage, remote
// fetch). ssr:false avoids any SSR/hydration work and keeps it desktop-friendly.
const RagStudioStandalone = dynamic(
  () => import('@/ui').then((m) => m.RagStudioStandalone),
  { ssr: false, loading: () => null },
);

export default function HomePage() {
  return (
    <div style={{ height: '100dvh', width: '100%', overflow: 'hidden' }}>
      <RagStudioStandalone />
    </div>
  );
}
