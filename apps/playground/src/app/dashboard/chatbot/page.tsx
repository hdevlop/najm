import { auth } from '@/lib/auth';
import { Chatbot } from 'najm-chatbot/react';

export const dynamic = 'force-dynamic';

export default async function ChatbotPage() {
  await auth.requireSession();

  return (
    <div className="min-h-[calc(100vh-7rem)]">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Najm</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">AI Chat</h1>
      </div>

      <Chatbot
        initialOpen
        apiPath="/api/chat"
        settingsApiPath="/api/ai-settings"
        mcpApiPath="/api/mcp"
        theme={{
          primary: '#1f3a68',
          radius: '8px',
        }}
      />
    </div>
  );
}
