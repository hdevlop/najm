// ============================================================================
// listener.ts - Runtime-specific HTTP listeners (Bun with Node fallback)
// ============================================================================

import { Err } from '../errors';

/**
 * `env` is the runtime's second fetch argument: the Bun `Server` under
 * `Bun.serve`, or `{ incoming, outgoing }` under `@hono/node-server`. It is the
 * only route to the real connection peer, so it is forwarded rather than
 * dropped — header-derived addresses cannot stand in for it.
 */
export type FetchHandler = (req: Request, env?: unknown) => Response | Promise<Response>;

export type ServerHandle = {
   readonly port: number;
   stop?: () => void | Promise<void>;
};

export async function createListener(fetch: FetchHandler, port: number): Promise<ServerHandle> {
   if (hasBunServe()) {
      return Bun.serve({ fetch, port });
   }

   return createNodeListener(fetch, port);
}

function hasBunServe(): boolean {
   return typeof Bun !== 'undefined' && typeof Bun.serve === 'function';
}

async function createNodeListener(fetch: FetchHandler, port: number): Promise<ServerHandle> {
   const { serve } = await importNodeServer();

   let resolvedPort = port;
   const nodeServer = await new Promise<any>((resolve, reject) => {
      let server: any;
      const onError = (error: unknown) => {
         server?.off?.('error', onError);
         reject(error);
      };

      server = serve({ fetch, port }, (info) => {
         resolvedPort = info.port;
         server?.off?.('error', onError);
         resolve(server);
      });
      server?.once?.('error', onError);
   });

   return {
      get port() {
         const address = nodeServer.address();
         return typeof address === 'object' && address !== null ? address.port : resolvedPort;
      },
      stop: () => stopNodeServer(nodeServer),
   };
}

function stopNodeServer(nodeServer: any): Promise<void> {
   return new Promise<void>((resolve, reject) => {
      if ('listening' in nodeServer && !nodeServer.listening) {
         resolve();
         return;
      }

      nodeServer.close((error?: Error) => {
         if (error) {
            if ((error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
               resolve();
               return;
            }
            reject(error);
            return;
         }
         resolve();
      });
   });
}

async function importNodeServer(): Promise<typeof import('@hono/node-server')> {
   try {
      return await import('@hono/node-server');
   } catch (cause) {
      throw Err.invalidState(
         'Running on Node requires the optional "@hono/node-server" package. Install it with: bun add @hono/node-server (or npm install @hono/node-server)',
         cause,
      );
   }
}
