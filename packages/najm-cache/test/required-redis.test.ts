import "reflect-metadata";
import { describe, test, expect } from "bun:test";
import { Server } from "najm-core";
import { CacheService, cache } from "../src";
import { RedisDriver, type RedisClient } from "../src/drivers/RedisDriver";

const SECRET_URL = "redis://:sup3rs3cret@cache.internal:6379/0";

/**
 * Minimal in-process Redis double. It models only the commands the driver
 * uses, plus enough state to prove TTL semantics and script atomicity.
 */
class FakeRedis implements RedisClient {
  store = new Map<string, string>();
  expiries = new Map<string, number>();
  status = "ready";
  pingCalls = 0;
  evalCalls = 0;
  failPing = false;

  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async mget(...keys: string[]) {
    return keys.map((key) => this.store.get(key) ?? null);
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK" as const;
  }
  async setex(key: string, seconds: number, value: string) {
    return this.psetex(key, seconds * 1000, value);
  }
  async psetex(key: string, ms: number, value: string) {
    this.store.set(key, value);
    this.expiries.set(key, Date.now() + ms);
    return "OK" as const;
  }
  async del(...keys: string[]) {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) removed += 1;
      this.expiries.delete(key);
    }
    return removed;
  }
  async exists(...keys: string[]) {
    return keys.filter((key) => this.store.has(key)).length;
  }
  async incr(key: string) {
    const next = Number(this.store.get(key) ?? "0") + 1;
    this.store.set(key, String(next));
    return next;
  }
  async expire(key: string, seconds: number) {
    return this.pexpire(key, seconds * 1000);
  }
  async pexpire(key: string, ms: number) {
    if (!this.store.has(key)) return 0;
    this.expiries.set(key, Date.now() + ms);
    return 1;
  }
  async ttl(key: string) {
    const pttl = await this.pttl(key);
    return pttl < 0 ? pttl : Math.ceil(pttl / 1000);
  }
  async pttl(key: string) {
    if (!this.store.has(key)) return -2;
    const expiry = this.expiries.get(key);
    if (expiry === undefined) return -1;
    return Math.max(0, expiry - Date.now());
  }
  async ping() {
    this.pingCalls += 1;
    if (this.failPing) throw new Error(`connection refused for ${SECRET_URL}`);
    return "PONG" as const;
  }

  /**
   * Executes the driver's counter script the way Redis does: as one
   * indivisible unit. Nothing may observe the key between INCR and PEXPIRE.
   */
  async eval(_script: string, _numKeys: number, key: string, ttlArg: string) {
    this.evalCalls += 1;
    const count = await this.incr(key);
    const ttlMs = Number(ttlArg);
    if (count === 1 && ttlMs > 0) {
      await this.pexpire(key, ttlMs);
      return [count, ttlMs];
    }
    return [count, await this.pttl(key)];
  }

  async quit() {
    return "OK" as const;
  }
}

const redisService = (client: RedisClient, required = true) =>
  new CacheService({
    driver: "redis",
    required,
    redis: { url: SECRET_URL, client },
    memory: { maxKeys: 10, cleanupInterval: 60_000 },
  } as never);

describe("required Redis mode", () => {
  test("a missing URL fails closed instead of falling back to memory", () => {
    expect(
      () => new CacheService({ driver: "redis", required: true, memory: {} } as never),
    ).toThrow(/requires a Redis URL/i);
  });

  test("a required cache with no Redis configuration refuses to start", () => {
    expect(() => new CacheService({ driver: "auto", required: true, memory: {} } as never)).toThrow(
      /must name its driver/i,
    );
  });

  test("the failure never echoes the URL or its credentials", async () => {
    const client = new FakeRedis();
    client.failPing = true;
    const service = redisService(client);

    // The driver's own failure carries the URL; nothing it raises may.
    const error = await service.verifyReady().then(
      () => {
        throw new Error("unreachable Redis resolved as ready");
      },
      (raised: Error) => raised,
    );

    expect(error.message).toMatch(/not reachable/i);
    const text = `${error.message}\n${error.stack ?? ""}`;
    expect(text).not.toContain("sup3rs3cret");
    expect(text).not.toContain("cache.internal");
  });

  test("required mode selects Redis rather than degrading silently", () => {
    const service = redisService(new FakeRedis());
    expect(service.type).toBe("redis");
    expect(service.isRedis).toBe(true);
  });

  test("optional mode still falls back to memory for existing consumers", () => {
    const service = new CacheService({ driver: "redis", memory: {} } as never);
    expect(service.type).toBe("memory");
  });

  test("ping reports readiness without exposing connection details", async () => {
    const client = new FakeRedis();
    const service = redisService(client);
    await expect(service.ping()).resolves.toBe(true);
    expect(client.pingCalls).toBe(1);
  });

  test("an unreachable Redis reports unready with a value-free error", async () => {
    const client = new FakeRedis();
    client.failPing = true;
    const service = redisService(client);
    await expect(service.ping()).resolves.toBe(false);
    await expect(service.verifyReady()).rejects.toThrow(/not reachable/i);
  });

  test("server initialization rejects an unreachable required Redis backend", async () => {
    const client = new FakeRedis();
    client.failPing = true;
    const server = new Server({ isolated: true }).use(cache({
      driver: "redis",
      required: true,
      redis: { url: SECRET_URL, client },
    }));

    const error = await server.init().then(
      () => {
        throw new Error("server initialized with an unreachable required cache");
      },
      (raised: Error) => raised,
    );

    expect(error.message).toMatch(/not reachable/i);
    expect(`${error.message}\n${error.stack ?? ""}`).not.toContain(SECRET_URL);
  });

  test("server initialization probes a reachable required Redis backend", async () => {
    const client = new FakeRedis();
    const server = new Server({ isolated: true }).use(cache({
      driver: "redis",
      required: true,
      redis: { url: SECRET_URL, client },
    }));

    await server.init();
    expect(client.pingCalls).toBe(1);
    await server.stop();
  });
});

describe("atomic counter semantics", () => {
  test("a new counter receives its TTL in the same atomic operation", async () => {
    const client = new FakeRedis();
    const driver = new RedisDriver({ url: SECRET_URL, client });

    const first = await driver.incr("probe", 60_000);

    expect(first.count).toBe(1);
    expect(client.evalCalls).toBe(1);
    // A counter must never exist without an expiry attached.
    expect(await client.pttl("probe")).toBeGreaterThan(0);
    expect(first.resetAt).toBeGreaterThan(Date.now());
  });

  test("an existing counter keeps its original window instead of sliding", async () => {
    const client = new FakeRedis();
    const driver = new RedisDriver({ url: SECRET_URL, client });

    await driver.incr("probe", 60_000);
    client.expiries.set("probe", Date.now() + 10_000);

    const second = await driver.incr("probe", 60_000);

    expect(second.count).toBe(2);
    // The window must not be extended by later requests in the same bucket.
    expect(second.resetAt - Date.now()).toBeLessThanOrEqual(10_000);
  });

  test("the counter survives recreating the service while the TTL is live", async () => {
    const client = new FakeRedis();

    const first = redisService(client);
    await first.incr("shared", 60_000);
    await first.incr("shared", 60_000);
    await first.destroy();

    const second = redisService(client);
    const revived = await second.incr("shared", 60_000);

    expect(revived.count).toBe(3);
  });
});
