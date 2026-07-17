import 'reflect-metadata';
import { Server, Controller, Get } from '../packages/najm-core/dist/index.mjs';

class NodeSmokeController {
  ping() {
    return { ok: true, runtime: 'node' };
  }
}

Controller('/node-smoke')(NodeSmokeController);
Get('/ping')(
  NodeSmokeController.prototype,
  'ping',
  Object.getOwnPropertyDescriptor(NodeSmokeController.prototype, 'ping'),
);

const server = new Server({ isolated: true, silent: true }).load(NodeSmokeController);

try {
  await server.listen(0);
  const response = await fetch(`http://127.0.0.1:${server.port}/node-smoke/ping`);
  const body = await response.json();

  if (response.status !== 200 || body?.ok !== true) {
    throw new Error(`Unexpected Node smoke response: ${response.status} ${JSON.stringify(body)}`);
  }

  console.log(`Node runtime smoke passed on ${process.version}`);
} finally {
  await server.stop();
}
