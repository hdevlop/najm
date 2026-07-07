// najm on Bun. Run: bun run servers/najm.ts
import 'reflect-metadata';
import { Controller, Get, Params, Server } from 'najm-core';

@Controller('/')
class BenchController {
   @Get('/json')
   json() {
      return { ok: true, id: 42 };
   }

   @Get('/users/:id')
   user(@Params('id') id: string) {
      return { id };
   }

   @Get('/__rss')
   rss() {
      return { rss: process.memoryUsage().rss };
   }
}

const server = new Server({ isolated: true, silent: true }).load(BenchController);
await server.listen(0);
console.log(`READY ${server.port}`);
