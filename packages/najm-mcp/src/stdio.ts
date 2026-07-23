import type { Server } from 'najm-core';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpBuilderService } from './McpBuilderService';

export interface ServeMcpStdioOptions {
  onError?: (error: Error) => void;
}

export async function serveMcpStdio(
  server: Server,
  options: ServeMcpStdioOptions = {}
): Promise<void> {
  await server.init();

  const builder = await server.container.resolve(McpBuilderService);
  await builder.ensureBuilt();

  const transport = new StdioServerTransport();

  let closed = false;

  const shutdown = async (code = 0) => {
    if (closed) {
      return;
    }
    closed = true;

    process.off('SIGTERM', onSigterm);
    process.off('SIGINT', onSigint);
    process.off('uncaughtException', onUncaughtException);

    await builder.mcpServer.close().catch(() => undefined);
    process.exit(code);
  };

  const onSigterm = () => {
    void shutdown(0);
  };

  const onSigint = () => {
    void shutdown(0);
  };

  const onUncaughtException = (error: unknown) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    options.onError?.(normalized);
    void shutdown(1);
  };

  process.on('SIGTERM', onSigterm);
  process.on('SIGINT', onSigint);
  process.on('uncaughtException', onUncaughtException);

  await builder.mcpServer.connect(transport as any);
}
