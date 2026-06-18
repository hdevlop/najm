import type { ReactNode } from 'react';
import '../src/studio/styles/index.css';

export const metadata = {
  title: 'RAG Studio',
  description: 'Standalone RAG Studio — inspect and tune the RAG engine of any running najm app.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
