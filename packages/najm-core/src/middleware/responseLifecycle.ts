import type { Context } from 'hono';

type Completion = () => void | Promise<void>;
type RunInContext = <T>(callback: () => T) => T;
type ResponseLifecycle = { callbacks: Completion[]; run: RunInContext; activate: Completion };

const bufferedBodies = new WeakSet<ReadableStream>();
const lifecycles = new WeakMap<Context, ResponseLifecycle>();

/** Framework-generated JSON/text is complete when its handler returns. */
export function bufferedResponse<T extends Response>(response: T): T {
   if (response.body) bufferedBodies.add(response.body);
   return response;
}

/** Raw response bodies may stream; finish their request when consumed or cancelled. */
export async function afterResponse(
   context: Context,
   callback: Completion,
   run?: RunInContext,
): Promise<void> {
   const existing = lifecycles.get(context);
   if (existing) {
      existing.callbacks.push(callback);
      if (run) {
         existing.run = run;
         await existing.activate();
      }
      return;
   }

   const response = context.res;
   const body = response.body;
   if (run && (!body || bufferedBodies.has(body))) {
      await callback();
      return;
   }
   const lifecycle: ResponseLifecycle = { callbacks: [callback], run: run ?? ((fn) => fn()), activate: () => {} };
   lifecycles.set(context, lifecycle);
   const signal = context.req.raw.signal;
   let reader: ReadableStreamDefaultReader | undefined;
   let completion: Promise<void> | undefined;
   let cancelled = false;
   let controller: ReadableStreamDefaultController;
   let abort: (() => void) | undefined;

   const finish = (): Promise<void> => completion ??= lifecycle.run(async () => {
      if (abort) signal.removeEventListener('abort', abort);
      reader?.releaseLock();
      // Outer request-scope cleanup registers last and must finish before the
      // drain counter reaches zero and server-owned providers are destroyed.
      for (const complete of lifecycle.callbacks.reverse()) await complete();
      lifecycles.delete(context);
   });

   if (!body || bufferedBodies.has(body)) {
      // The inner drain middleware registers first. Wait for outer scope
      // cleanup to register too, even when there is no streaming body.
      lifecycle.activate = finish;
      if (run) await finish();
      return;
   }
   reader = body.getReader();

   const cancel = async (reason?: unknown): Promise<void> => {
      cancelled = true;
      try {
         await lifecycle.run(() => reader.cancel(reason));
      } finally {
         await finish();
      }
   };
   abort = () => {
      // Let the runtime cancel its response reader on disconnect before
      // surfacing the abort to any remaining body consumer.
      void cancel(signal.reason).then(
         () => controller.error(signal.reason),
         () => controller.error(signal.reason),
      );
   };

   const stream = new ReadableStream({
      start(value) { controller = value; },
      async pull(value) {
         try {
            const chunk = await lifecycle.run(() => reader.read());
            if (cancelled) return;
            if (chunk.done) {
               await finish();
               value.close();
            } else {
               value.enqueue(chunk.value);
            }
         } catch (error) {
            if (cancelled) return;
            await finish();
            value.error(error);
         }
      },
      cancel,
   }, { highWaterMark: 0 });

   context.res = new Response(stream, response);
   lifecycle.activate = () => {
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
   };
   if (run) lifecycle.activate();
}
