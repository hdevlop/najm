import React from 'react';
import { Construction } from 'lucide-react';

interface ComingSoonPageProps {
  name: string;
}

export function ComingSoonPage({ name }: ComingSoonPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
      <div className="p-4 rounded-full bg-muted">
        <Construction size={32} className="text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">{name}</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Docs for this component are coming soon. Check the source code in{' '}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">packages/najm-kit/src</code>{' '}
        for usage examples.
      </p>
    </div>
  );
}
