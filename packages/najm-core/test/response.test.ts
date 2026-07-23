import "reflect-metadata";
import { describe, expect, it } from "bun:test";

import {
  Controller,
  Get,
  Post,
  ResMsg,
  Server,
} from "../dist/index.mjs";

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

describe("response messages", () => {
  it("wraps decorated responses and resolves i18n message keys", async () => {
    class ResponseController {
      list() {
        return [{ id: "item-1" }];
      }

      create() {
        return { id: "item-2" };
      }
    }

    decorateMethod(
      ResponseController.prototype,
      "list",
      Get("/"),
      ResMsg("items.success.retrieved"),
    );
    decorateMethod(
      ResponseController.prototype,
      "create",
      Post("/"),
      ResMsg({ message: "items.success.created", status: 201 }),
    );
    decorateClass(ResponseController, Controller("/items"));

    const server = new Server({ isolated: true, silent: true }).load(ResponseController);

    const listResponse = await server.fetch(new Request("http://localhost/items"));
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      data: [{ id: "item-1" }],
      message: "items.success.retrieved",
      status: "success",
    });

    const createResponse = await server.fetch(
      new Request("http://localhost/items", { method: "POST" }),
    );
    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toEqual({
      data: { id: "item-2" },
      message: "items.success.created",
      status: "success",
    });

    await server.stop();
  });
});
