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
   /**
    * Stops accepting connections and closes idle keep-alive connections;
    * resolves once active requests finish. `force` closes the remaining
    * connections instead of waiting.
    */
   stop?: (force?: boolean) => void | Promise<void>;
};

export async function createListener(fetch: FetchHandler, port: number): Promise<ServerHandle> {
   if (hasBunServe()) {
      return createBunListener(fetch, port);
   }

   return createNodeListener(fetch, port);
}

function hasBunServe(): boolean {
   return typeof Bun !== 'undefined' && typeof Bun.serve === 'function';
}

function createBunListener(fetch: FetchHandler, port: number): ServerHandle {
   // closeIdleConnections exists at runtime but is missing from older bun-types.
   const bunServer: ReturnType<typeof Bun.serve> & { closeIdleConnections?: () => void } =
      Bun.serve({ fetch, port });

   return {
      get port() {
         return bunServer.port;
      },
      stop: async (force) => {
         // A graceful stop leaves keep-alive sockets open, so a pooled client
         // connection keeps reaching this server, even after another server
         // binds the port. Bun ignores a later forced stop, so idle sockets are
         // closed now and the busy ones once their requests finish.
         const stopped = bunServer.stop(force);
         bunServer.closeIdleConnections?.();
         await stopped;
         bunServer.closeIdleConnections?.();
      },
   };
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
      stop: (force) => stopNodeServer(nodeServer, force),
   };
}

function stopNodeServer(nodeServer: any, force = false): Promise<void> {
   // close() waits for every open connection; dropping them is the only way
   // to bound a stalled request. Available on http/https servers (Node 18.2+).
   if (force) nodeServer.closeAllConnections?.();

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
