// Raw Hono baseline (Bun). Run: bun run servers/hono.ts
import { Hono } from 'hono';

const app = new Hono();
app.get('/json', (c) => c.json({ ok: true, id: 42 }));
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));
app.get('/__rss', (c) => c.json({ rss: process.memoryUsage().rss }));

const server = Bun.serve({ fetch: app.fetch, port: 0 });
console.log(`READY ${server.port}`);
