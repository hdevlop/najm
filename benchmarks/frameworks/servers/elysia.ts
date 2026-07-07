// Elysia on Bun. Run: bun run servers/elysia.ts
import { Elysia } from 'elysia';

new Elysia()
   .get('/json', () => ({ ok: true, id: 42 }))
   .get('/users/:id', ({ params }) => ({ id: params.id }))
   .get('/__rss', () => ({ rss: process.memoryUsage().rss }))
   .listen(0, (server) => {
      console.log(`READY ${server.port}`);
   });
