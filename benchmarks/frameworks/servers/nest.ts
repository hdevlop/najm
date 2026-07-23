// NestJS with the Fastify adapter (executed on Bun for a same-runtime
// comparison). Run: bun run servers/nest.ts
import 'reflect-metadata';
import { Controller, Get, Module, Param } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

@Controller()
class BenchController {
   @Get('/json')
   json() {
      return { ok: true, id: 42 };
   }

   @Get('/users/:id')
   user(@Param('id') id: string) {
      return { id };
   }

   @Get('/__rss')
   rss() {
      return { rss: process.memoryUsage().rss };
   }
}

@Module({ controllers: [BenchController] })
class AppModule {}

const app = await NestFactory.create<NestFastifyApplication>(
   AppModule,
   new FastifyAdapter(),
   { logger: false },
);
await app.listen(0, '127.0.0.1');
const url = await app.getUrl();
console.log(`READY ${new URL(url).port}`);
