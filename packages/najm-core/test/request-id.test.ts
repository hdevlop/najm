import "reflect-metadata";
import { afterEach, describe, expect, it } from "bun:test";

import { Controller, Err, Get, Server } from "../dist/index.mjs";

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
  if (!descriptor) throw new Error(`Missing descriptor for ${methodName}`);

  for (const decorator of decorators.reverse()) {
    decorator(target, methodName, descriptor);
  }
}

class RequestIdController {
  json() {
    return { ok: true };
  }

  syncThrow() {
    Err.notFound("User not found");
  }

  async asyncThrow() {
    Err.notFound("User not found");
  }

  crash() {
    throw new Error("boom");
  }

  raw() {
    return new Response("raw body", { status: 202 });
  }

  ownId() {
    return new Response("own", { headers: { "x-request-id": "set-by-handler" } });
  }

  redirect() {
    // Response.redirect() has immutable headers.
    return Response.redirect("http://localhost/elsewhere", 302);
  }
}

decorateMethod(RequestIdController.prototype, "json", Get("/json"));
decorateMethod(RequestIdController.prototype, "syncThrow", Get("/sync-throw"));
decorateMethod(RequestIdController.prototype, "asyncThrow", Get("/async-throw"));
decorateMethod(RequestIdController.prototype, "crash", Get("/crash"));
decorateMethod(RequestIdController.prototype, "raw", Get("/raw"));
decorateMethod(RequestIdController.prototype, "redirect", Get("/redirect"));
decorateMethod(RequestIdController.prototype, "ownId", Get("/own-id"));
decorateClass(RequestIdController, Controller("/rid"));

const servers: Server[] = [];

function createServer(): Server {
  const server = new Server({ isolated: true, silent: true }).load(RequestIdController);
  servers.push(server);
  return server;
}

describe("x-request-id response header", () => {
  afterEach(async () => {
    while (servers.length) {
      await servers.pop()?.stop();
    }
  });

  const cases: Array<[string, string, number]> = [
    ["a JSON result", "/rid/json", 200],
    ["a synchronously thrown HttpError", "/rid/sync-throw", 404],
    ["an asynchronously thrown HttpError", "/rid/async-throw", 404],
    ["an unexpected error", "/rid/crash", 500],
    ["a raw Response", "/rid/raw", 202],
    ["a redirect with immutable headers", "/rid/redirect", 302],
  ];

  for (const [label, path, status] of cases) {
    it(`is set on ${label}`, async () => {
      const response = await createServer().fetch(new Request(`http://localhost${path}`));

      expect(response.status).toBe(status);
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });
  }

  it("echoes a client-supplied id on an error response", async () => {
    const response = await createServer().fetch(new Request("http://localhost/rid/sync-throw", {
      headers: { "x-request-id": "client-id-123" },
    }));

    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toBe("client-id-123");
  });

  it("keeps an id the handler set itself", async () => {
    const response = await createServer().fetch(new Request("http://localhost/rid/own-id"));

    expect(response.headers.get("x-request-id")).toBe("set-by-handler");
  });

  it("is set when a global middleware throws", async () => {
    const server = createServer().middleware(async () => {
      Err.unauthorized("No token");
    });

    const response = await server.fetch(new Request("http://localhost/rid/json"));

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("keeps the error body intact", async () => {
    const response = await createServer().fetch(new Request("http://localhost/rid/sync-throw"));

    expect(await response.json()).toEqual({
      code: "HTTP_404",
      message: "User not found",
      status: 404,
    });
  });
});
