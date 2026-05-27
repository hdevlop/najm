'use client';

import { useAuthEvents, useAuthEvent } from 'najm-auth/client/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export function EventLogSection() {
  const events = useAuthEvents({ maxEntries: 20 });

  useAuthEvent('sessionExpired', () => {
    toast.error('Session expired — please log in again.');
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Auth Events</h3>
        <p className="text-sm text-muted-foreground">
          Live log of auth events emitted by the client SDK.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No events yet. Trigger one by logging out, refreshing, or changing your password.
        </p>
      ) : (
        <div className="space-y-2">
          {events
            .slice()
            .reverse()
            .map((entry, i) => (
              <div key={i} className="flex items-start gap-3 rounded border px-3 py-2 text-sm">
                <Badge variant="outline" className="shrink-0">
                  {entry.event}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                {entry.data != null ? (
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {typeof entry.data === 'object' ? JSON.stringify(entry.data) : String(entry.data)}
                  </span>
                ) : null}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
