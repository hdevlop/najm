// Layer-by-layer overhead breakdown: where do najm's µs/request go?
// Run: bun layers.bench.ts   (cwd must have decorator tsconfig for najm import)
import 'reflect-metadata';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { randomUUID } from 'node:crypto';
import { Container } from 'diject';
import { Controller, Get, Params, RequestParser, Server } from 'najm-core';

const ITER = 50_000;
const WARM = 5_000;

type H = (req: Request) => Response | Promise<Response>;

function decorateClass(target: Function, ...decorators: ClassDecorator[]) {
   for (const decorator of decorators.reverse()) {
      decorator(target);
   }
}

function decorateMethod(
   target: object,
   methodName: string,
   ...decorators: MethodDecorator[]
) {
   const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
   if (!descriptor) {
      throw new Error(`Missing descriptor for ${methodName}`);
   }

   for (const decorator of decorators.reverse()) {
      decorator(target, methodName, descriptor);
   }
}

function decorateParam(target: object, methodName: string, index: number, decorator: ParameterDecorator) {
   decorator(target, methodName, index);
}

async function bench(name: string, fetch: H, url: string): Promise<number> {
   for (let i = 0; i < WARM; i++) await fetch(new Request(url));
   const t0 = performance.now();
   for (let i = 0; i < ITER; i++) await fetch(new Request(url));
   const us = ((performance.now() - t0) / ITER) * 1000;
   console.log(`${name.padEnd(44)} ${us.toFixed(2).padStart(7)} µs/op`);
   return us;
}

const U = 'http://localhost/users/123';

// A. raw hono
const a = new Hono();
a.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));

// B. + contextStorage middleware
const b = new Hono();
b.use('*', contextStorage());
b.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));

// C. + requestId (header check + randomUUID)
const c_ = new Hono();
c_.use('*', contextStorage());
c_.use('*', async (c, next) => {
   const rid = c.req.header('x-request-id') || randomUUID();
   c.header('x-request-id', rid);
   await next();
});
c_.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));

// D. + RequestParser + container.run + cleanupReq (najm's request-context clone)
const cont = new Container();
const d = new Hono();
d.use('*', contextStorage());
d.use('*', async (c, next) => {
   const requestId = c.req.header('x-request-id') || randomUUID();
   c.header('x-request-id', requestId);
   const parser = new RequestParser(c as any);
   const request = parser.createRequest();
   return cont.run({ requestId, context: c, request, parser }, async () => {
      try {
         return await next();
      } finally {
         await cont.cleanupReq();
      }
   });
});
d.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));

// E. full najm
class C {
   user(id: string) {
      return { id };
   }
   plain() {
      return { ok: true };
   }
}
decorateParam(C.prototype, 'user', 0, Params('id'));
decorateMethod(C.prototype, 'user', Get('/users/:id'));
decorateMethod(C.prototype, 'plain', Get('/plain'));
decorateClass(C, Controller('/'));

const najm = new Server({ isolated: true, silent: true }).load(C);
await najm.init();
const najmFetch: H = (r) => najm.fetch(r);

console.log(`\nLayer breakdown — ${ITER.toLocaleString()} iters, bun ${Bun.version}\n`);
const va = await bench('A raw hono', (r) => a.fetch(r), U);
const vb = await bench('B + contextStorage', (r) => b.fetch(r), U);
const vc = await bench('C + requestId header/uuid', (r) => c_.fetch(r), U);
const vd = await bench('D + parser + container.run + cleanup', (r) => d.fetch(r), U);
const vp = await bench('E najm /plain (no param decorators)', najmFetch, 'http://localhost/plain');
const ve = await bench('E najm /users/:id (full)', najmFetch, U);

console.log('\nDeltas (cost of each layer):');
console.log(`  contextStorage:            ${(vb - va).toFixed(2)} µs`);
console.log(`  requestId/uuid:            ${(vc - vb).toFixed(2)} µs`);
console.log(`  parser+ALS run+cleanup:    ${(vd - vc).toFixed(2)} µs`);
console.log(`  najm routing/dispatch/fmt: ${(vp - vd).toFixed(2)} µs (plain route)`);
console.log(`  param resolution (:id):    ${(ve - vp).toFixed(2)} µs`);
console.log(`  TOTAL najm vs raw hono:    ${(ve - va).toFixed(2)} µs`);
await najm.stop();
