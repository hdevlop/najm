import "reflect-metadata";
import { afterEach, describe, expect, test } from "bun:test";
import { Controller, Get, reset, Server, Service } from "najm-core";
import { database, Transaction } from "../src";

// A dev server's hot reload builds a new Server in the same process while the
// modules that did not change keep their classes. The new boot must not see
// the injections the previous boot registered on the shared container.
class MockDatabase {
  async connect() {}
  async disconnect() {}
  async query() {
    return { rows: [] };
  }
  async transaction<T>(fn: (trx: unknown) => Promise<T>) {
    return fn(this);
  }
}

@Service()
class LedgerService {
  @Transaction()
  async review() {
    return "reviewed";
  }
}

@Controller("/ledger")
class LedgerController {
  constructor(private ledger: LedgerService) {}

  @Get("/")
  async read() {
    return this.ledger.review();
  }
}

const servers: Server[] = [];
const boot = async () => {
  const server = new Server({ silent: true })
    .use(database(new MockDatabase()))
    .load(LedgerService, LedgerController);
  servers.push(server);
  await server.init();
  return server;
};

describe("rebooting on the shared container", () => {
  afterEach(async () => {
    for (const server of servers.splice(0)) await server.stop().catch(() => {});
    await reset();
  });

  test("a second server boots the same decorated classes and serves them", async () => {
    await boot();
    const second = await boot();

    const response = await second.fetch(new Request("http://localhost/ledger"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("reviewed");
  });
});
