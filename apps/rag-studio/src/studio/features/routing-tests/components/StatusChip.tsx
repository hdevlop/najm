import React from 'react';
import { Badge } from 'najm-kit';
import { CheckCircle2, XCircle, Target } from 'lucide-react';

export function StatusChip({ status }: { status: 'pass' | 'fail' | 'low_confidence' }) {
  if (status === 'pass') {
    return (
      <Badge variant="success" className="h-6 gap-1 rounded-md px-2 text-[11px] uppercase leading-none tracking-[0.08em] whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" />
        Passed
      </Badge>
    );
  }

  if (status === 'low_confidence') {
    return (
      <Badge variant="warning" className="h-6 gap-1 rounded-md px-2 text-[11px] uppercase leading-none tracking-[0.08em] whitespace-nowrap">
        <XCircle className="h-3 w-3" />
        Low conf
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="h-6 gap-1 rounded-md px-2 text-[11px] uppercase leading-none tracking-[0.08em] whitespace-nowrap">
      <XCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
}

export function PendingChip() {
  return (
    <Badge variant="outline" className="h-6 gap-1 rounded-md px-2 text-[11px] uppercase leading-none tracking-[0.08em] whitespace-nowrap">
      <Target className="h-3 w-3" />
      Pending
    </Badge>
  );
}
