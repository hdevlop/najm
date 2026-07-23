// Fastify (Node-API framework, executed on Bun for a same-runtime comparison).
// Run: bun run servers/fastify.ts
import Fastify from 'fastify';

const app = Fastify({ logger: false });
app.get('/json', async () => ({ ok: true, id: 42 }));
app.get('/users/:id', async (req) => ({ id: (req.params as { id: string }).id }));
app.get('/__rss', async () => ({ rss: process.memoryUsage().rss }));

await app.listen({ port: 0, host: '127.0.0.1' });
const addr = app.server.address();
const port = typeof addr === 'object' && addr ? addr.port : addr;
console.log(`READY ${port}`);
