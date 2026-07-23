import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApiClient } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'najm-kit';

interface QrModalProps {
  instanceId: string;
  onClose: () => void;
}

export function QrModal({ instanceId, onClose }: QrModalProps) {
  const api = useApiClient();
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [qrRes, listRes] = await Promise.all([
          api.get(`/instances/${instanceId}/qr`),
          api.get('/instances'),
        ]);
        if (cancelled) return;
        setQr(qrRes.qr ?? null);
        const inst = Array.isArray(listRes)
          ? listRes.find((i: any) => i.id === instanceId)
          : null;
        if (inst?.status) {
          setStatus(inst.status);
          setLastError(inst.lastError ?? null);
          if (inst.status === 'connected') {
            onClose();
          }
        }
      } catch {
        // ignore poll errors
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [api, instanceId, onClose]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect Instance</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {qr ? (
            <div className="rounded-md bg-white p-3">
              <QRCodeSVG value={qr} size={200} />
            </div>
          ) : elapsed > 30 ? (
            <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 rounded-md border border-status-yellow/30 bg-status-yellow/5 px-4 text-center">
              <AlertTriangle className="h-6 w-6 text-status-yellow" />
              <p className="text-xs font-medium text-status-yellow">QR not received</p>
              <p className="text-[10px] text-txt-muted">
                {lastError || "Baileys hasn't emitted a QR. Try disconnecting & reconnecting."}
              </p>
            </div>
          ) : (
            <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-3 rounded-md bg-surface text-xs text-txt-muted">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <span>Waiting for QR code…</span>
              <span className="text-[10px]">{elapsed}s</span>
            </div>
          )}
          <p className="text-center text-xs text-txt-secondary">
            {status === 'connected'
              ? 'Connected!'
              : 'Open WhatsApp → Settings → Linked Devices → Link a Device'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
