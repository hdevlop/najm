import { describe, expect, mock, test } from 'bun:test';
import { serveMcpStdio } from '../src';

describe('najm-mcp stdio', () => {
  test('registers graceful shutdown handlers and connects stdio transport', async () => {
    const originalOn = process.on;
    const originalOff = process.off;

    const listeners: Record<string, ((error?: unknown) => void)[]> = {};

    const onMock = mock((event: string, handler: (error?: unknown) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(handler);
      return process;
    });

    const offMock = mock((event: string, handler: (error?: unknown) => void) => {
      listeners[event] = (listeners[event] ?? []).filter((fn) => fn !== handler);
      return process;
    });

    (process as any).on = onMock;
    (process as any).off = offMock;

    const closeMock = mock(async () => undefined);
    const connectMock = mock(async () => undefined);
    const ensureBuiltMock = mock(async () => undefined);

    const fakeBuilder = {
      ensureBuilt: ensureBuiltMock,
      mcpServer: {
        connect: connectMock,
        close: closeMock,
      },
    };

    const initMock = mock(async () => undefined);
    const resolveMock = mock(async () => fakeBuilder);

    const fakeServer = {
      init: initMock,
      container: {
        resolve: resolveMock,
      },
    } as any;

    try {
      await serveMcpStdio(fakeServer);

      expect(initMock).toHaveBeenCalled();
      expect(resolveMock).toHaveBeenCalled();
      expect(ensureBuiltMock).toHaveBeenCalled();
      expect(connectMock).toHaveBeenCalled();

      expect(typeof listeners.SIGTERM?.[0]).toBe('function');
      expect(typeof listeners.SIGINT?.[0]).toBe('function');
      expect(typeof listeners.uncaughtException?.[0]).toBe('function');
      expect(closeMock).not.toHaveBeenCalled();
    } finally {
      (process as any).on = originalOn;
      (process as any).off = originalOff;
    }
  });
});
