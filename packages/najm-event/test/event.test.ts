import "reflect-metadata";
import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { Err, Server } from "najm-core";
import { Container, Controller, DI, Inject, reset, Service } from "najm-core";
import { Events, On, events, EVENT_SERVICE, EventService, type EventEmitter } from "../src";
import { Body, Params, Get, Post } from "najm-core";

describe("EventService Tests - @Events() Decorator & Constructor Injection", () => {
  let server: Server;
  let baseURL: string;

  beforeEach(async () => {
    await reset();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    await reset(); // Clean up after each test to prevent pollution
  });

  // ==========================================
  // BASIC EVENT OPERATIONS WITH @Events()
  // ==========================================

  describe("Basic Event Operations with @Events()", () => {
    test("emits and listens to basic events", async () => {
      const receivedEvents: any[] = [];

      @Service()
      class TestService {
        @Events() private events: EventEmitter;

        constructor() {
          this.events.on("test-event", (data: any) => {
            receivedEvents.push(data);
          });
        }

        triggerEvent() {
          this.events.emit("test-event", { message: "Hello" });
        }
      }

      @Controller("/events")
      class EventController {
        constructor(private testService: TestService) { }

        @Get("/trigger")
        trigger() {
          this.testService.triggerEvent();
          return { message: "Event triggered" };
        }

        @Get("/check")
        check() {
          return { events: receivedEvents };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, EventController)
        .listen(5001);

      baseURL = "http://localhost:5001";

      await fetch(`${baseURL}/events/trigger`);
      const response = await fetch(`${baseURL}/events/check`);
      const data = await response.json();

      expect(data.events).toHaveLength(1);
      expect(data.events[0].message).toBe("Hello");
    });

    test("emits events without data using different property name", async () => {
      let eventFired = false;

      @Service()
      class TestService {
        @Events() private emit: EventEmitter; // Different name

        constructor() {
          this.emit.on("no-data-event", () => {
            eventFired = true;
          });
        }

        triggerEvent() {
          this.emit.emit("no-data-event");
        }
      }

      @Controller("/events")
      class EventController {
        constructor(private testService: TestService) { }

        @Get("/trigger")
        trigger() {
          this.testService.triggerEvent();
          return { fired: eventFired };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, EventController)
        .listen(5002);

      baseURL = "http://localhost:5002";

      const response = await fetch(`${baseURL}/events/trigger`);
      const data = await response.json();

      expect(data.fired).toBe(true);
    });

    test("handles multiple listeners with eventBus property name", async () => {
      const listener1Calls: any[] = [];
      const listener2Calls: any[] = [];

      @Service()
      class TestService {
        @Events() private eventBus: EventEmitter; // Different name

        constructor() {
          this.eventBus.on("shared-event", (data: any) => {
            listener1Calls.push({ listener: 1, data });
          });

          this.eventBus.on("shared-event", (data: any) => {
            listener2Calls.push({ listener: 2, data });
          });
        }

        triggerEvent(value: string) {
          this.eventBus.emit("shared-event", { value });
        }
      }

      @Controller("/events")
      class EventController {
        constructor(private testService: TestService) { }

        @Post("/trigger")
        trigger(@Body() body: { value: string }) {
          this.testService.triggerEvent(body.value);
          return { message: "Event triggered" };
        }

        @Get("/stats")
        getStats() {
          return {
            listener1: listener1Calls.length,
            listener2: listener2Calls.length,
          };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, EventController)
        .listen(5003);

      baseURL = "http://localhost:5003";

      await fetch(`${baseURL}/events/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "test" }),
      });

      const response = await fetch(`${baseURL}/events/stats`);
      const data = await response.json();

      expect(data.listener1).toBe(1);
      expect(data.listener2).toBe(1);
    });
  });

  // ==========================================
  // CONSTRUCTOR INJECTION (LEGACY PATTERN)
  // ==========================================

  describe("Constructor Injection Pattern (Legacy)", () => {
    test("works with constructor injection", async () => {
      const receivedEvents: any[] = [];

      @Service()
      class TestService {
        constructor(@Inject(EventService) private events: EventService) { } // Traditional way

        async onInit() {
          this.events.on("legacy-event", (data: any) => {
            receivedEvents.push(data);
          });
        }

        triggerEvent() {
          this.events.emit("legacy-event", { message: "Legacy style" });
        }
      }

      @Controller("/events")
      class EventController {
        constructor(private testService: TestService) { }

        @Get("/trigger")
        trigger() {
          this.testService.triggerEvent();
          return { events: receivedEvents };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, EventController)
        .listen(5004);

      baseURL = "http://localhost:5004";

      const response = await fetch(`${baseURL}/events/trigger`);
      const data = await response.json();

      expect(data.events).toHaveLength(1);
      expect(data.events[0].message).toBe("Legacy style");
    });

    test("constructor injection for getStats", async () => {
      @Service()
      class ServiceA {
        @On("stats.event")
        handler() { }
      }

      @Service()
      class StatsService {
        constructor(@Inject(EventService) private events: EventService) { } // Need full service for getStats

        getStats() {
          return this.events.getStats();
        }
      }

      @Controller("/stats")
      class StatsController {
        constructor(private statsService: StatsService) { }

        @Get("/")
        getStats() {
          return this.statsService.getStats();
        }
      }

      server = await new Server()
        .use(events())
        .load(ServiceA, StatsService, StatsController)
        .listen(5005);

      baseURL = "http://localhost:5005";

      const response = await fetch(`${baseURL}/stats`);
      const data = await response.json();

      expect(data.totalProviders).toBeGreaterThan(0);
      expect(data.providers).toContain("ServiceA");
    });
  });

  // ==========================================
  // CONTAINER DEBUG TEST
  // ==========================================

  describe("Container State", () => {
    test("EventService should be properly registered", async () => {
      @Service()
      class DebugService {
        @DI() private container!: Container;  // Use @DI() decorator

        checkEventService() {
          const hasEventService = this.container.has(EventService);
          const hasEventServiceToken = this.container.has(EVENT_SERVICE);

          return {
            hasEventService,
            hasEventServiceToken,
            containerKeys: Array.from(this.container.registry.keys()).map((k: any) =>
              typeof k === 'function' ? k.name : String(k)
            )
          };
        }
      }

      @Controller("/debug")
      class DebugController {
        constructor(private debugService: DebugService) { }

        @Get("/check")
        check() {
          return this.debugService.checkEventService();
        }
      }

      server = await new Server()
        .use(events())
        .load(DebugService, DebugController)
        .listen(6009);

      baseURL = "http://localhost:6009";

      const response = await fetch(`${baseURL}/debug/check`);
      const data = await response.json();
      expect(data.containerKeys).toBeDefined();
    });
  });

  // ==========================================
  // REMOVING LISTENERS
  // ==========================================

  describe("Removing Listeners", () => {
    test("removes a specific listener with notify property", async () => {
      let callCount = 0;
      let handlerRef: any;

      @Service()
      class TestService {
        @Events() private notify: EventEmitter; // Different name

        constructor() {
          handlerRef = (data: any) => {
            callCount++;
          };
          this.notify.on("removable-event", handlerRef);
        }

        triggerEvent() {
          this.notify.emit("removable-event", {});
        }

        removeListener() {
          this.notify.off("removable-event", handlerRef);
        }
      }

      @Controller("/events")
      class EventController {
        constructor(private testService: TestService) { }

        @Get("/trigger")
        trigger() {
          this.testService.triggerEvent();
          return { count: callCount };
        }

        @Get("/remove")
        remove() {
          this.testService.removeListener();
          return { message: "Removed" };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, EventController)
        .listen(5010);

      baseURL = "http://localhost:5010";

      await fetch(`${baseURL}/events/trigger`);
      let response = await fetch(`${baseURL}/events/trigger`);
      let data = await response.json();
      expect(data.count).toBe(2);

      await fetch(`${baseURL}/events/remove`);

      response = await fetch(`${baseURL}/events/trigger`);
      data = await response.json();
      expect(data.count).toBe(2);
    });

    test("removes all listeners using track property", async () => {
      let count1 = 0;
      let count2 = 0;

      @Service()
      class TestService {
        @Events() private track: EventEmitter; // Different name

        constructor() {
          this.track.on("multi-event", () => count1++);
          this.track.on("multi-event", () => count2++);
        }

        triggerEvent() {
          this.track.emit("multi-event", {});
        }

        removeAll() {
          this.track.off("multi-event");
        }
      }

      @Controller("/events")
      class EventController {
        constructor(private testService: TestService) { }

        @Get("/trigger")
        trigger() {
          this.testService.triggerEvent();
          return { count1, count2 };
        }

        @Get("/remove-all")
        removeAll() {
          this.testService.removeAll();
          return { message: "All removed" };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, EventController)
        .listen(5011);

      baseURL = "http://localhost:5011";

      await fetch(`${baseURL}/events/trigger`);
      await fetch(`${baseURL}/events/remove-all`);
      const response = await fetch(`${baseURL}/events/trigger`);
      const data = await response.json();

      expect(data.count1).toBe(1);
      expect(data.count2).toBe(1);
    });
  });

  // ==========================================
  // ONCE LISTENERS
  // ==========================================

  describe("Once (one-time listeners)", () => {
    test("once listener fires only once", async () => {
      let callCount = 0;

      @Service()
      class TestService {
        @Events() private events: EventEmitter;

        constructor() {
          this.events.once("once-event", () => {
            callCount++;
          });
        }

        triggerEvent() {
          this.events.emit("once-event", {});
        }
      }

      @Controller("/events")
      class EventController {
        constructor(private testService: TestService) { }

        @Get("/trigger")
        trigger() {
          this.testService.triggerEvent();
          return { count: callCount };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, EventController)
        .listen(5015);

      baseURL = "http://localhost:5015";

      await fetch(`${baseURL}/events/trigger`);
      await fetch(`${baseURL}/events/trigger`);
      const response = await fetch(`${baseURL}/events/trigger`);
      const data = await response.json();

      expect(data.count).toBe(1);
    });

    test("multiple once listeners with emit property", async () => {
      let count1 = 0;
      let count2 = 0;

      @Service()
      class TestService {
        @Events() private emit: EventEmitter; // Different name

        constructor() {
          this.emit.once("multi-once", () => count1++);
          this.emit.once("multi-once", () => count2++);
        }

        triggerEvent() {
          this.emit.emit("multi-once", {});
        }
      }

      @Controller("/events")
      class EventController {
        constructor(private testService: TestService) { }

        @Get("/trigger")
        trigger() {
          this.testService.triggerEvent();
          return { count1, count2 };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, EventController)
        .listen(5016);

      baseURL = "http://localhost:5016";

      await fetch(`${baseURL}/events/trigger`);
      await fetch(`${baseURL}/events/trigger`);
      const response = await fetch(`${baseURL}/events/trigger`);
      const data = await response.json();

      expect(data.count1).toBe(1);
      expect(data.count2).toBe(1);
    });
  });

  // ==========================================
  // ASYNC EVENTS
  // ==========================================

  describe("Async Event Operations", () => {
    test("emitAsync waits for all handlers", async () => {
      const executionOrder: string[] = [];

      @Service()
      class AsyncService {
        @On("async.test")
        async handler1(data: any) {
          await new Promise((r) => setTimeout(r, 30));
          executionOrder.push("handler1");
        }

        @On("async.test")
        async handler2(data: any) {
          await new Promise((r) => setTimeout(r, 10));
          executionOrder.push("handler2");
        }

        @On("async.test")
        async handler3(data: any) {
          await new Promise((r) => setTimeout(r, 20));
          executionOrder.push("handler3");
        }
      }

      @Service()
      class EmitterService {
        @Events() private notify: EventEmitter; // Different name

        async emitAsync(data: any) {
          await this.notify.emitAsync("async.test", data);
        }
      }

      @Controller("/async")
      class AsyncController {
        constructor(private emitter: EmitterService) { }

        @Post("/emit")
        async emit(@Body() body: any) {
          await this.emitter.emitAsync(body);
          return { order: executionOrder };
        }
      }

      server = await new Server()
        .use(events())
        .load(AsyncService, EmitterService, AsyncController)
        .listen(5020);

      baseURL = "http://localhost:5020";

      const response = await fetch(`${baseURL}/async/emit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "test" }),
      });
      const data = await response.json();

      expect(data.order).toHaveLength(3);
      expect(data.order[0]).toBe("handler2");
    });

    test("emitAsync throws AggregateError on failure", async () => {
      @Service()
      class FailingService {
        @On("async.fail")
        async handler1() {
          Err("Handler 1 failed");
        }

        @On("async.fail")
        async handler2() {
          return "success";
        }

        @On("async.fail")
        async handler3() {
          Err("Handler 3 failed");
        }
      }

      @Service()
      class EmitterService {
        @Events() private events: EventEmitter;

        async emitAndCatch() {
          try {
            await this.events.emitAsync("async.fail", {});
            return { success: true, caught: false };
          } catch (error: any) {
            return {
              success: false,
              caught: true,
              errorType: error.constructor.name,
              errorCount: error.errors?.length ?? 0,
            };
          }
        }
      }

      @Controller("/async")
      class AsyncController {
        constructor(private emitter: EmitterService) { }

        @Post("/emit")
        async emit() {
          return await this.emitter.emitAndCatch();
        }
      }

      server = await new Server()
        .use(events())
        .load(FailingService, EmitterService, AsyncController)
        .listen(5021);

      baseURL = "http://localhost:5021";

      const response = await fetch(`${baseURL}/async/emit`, { method: "POST" });
      const data = await response.json();

      expect(data.caught).toBe(true);
      expect(data.errorType).toBe("AggregateError");
      expect(data.errorCount).toBe(2);
    });
  });

  // ==========================================
  // @On DECORATOR
  // ==========================================

  describe("@On Decorator", () => {
    test("@On decorator with track property", async () => {
      const receivedData: any[] = [];

      @Service()
      class DecoratorService {
        @On("decorator.event")
        handleEvent(data: any) {
          receivedData.push(data);
        }
      }

      @Service()
      class EmitterService {
        @Events() private track: EventEmitter; // Different name

        emit(data: any) {
          this.track.emit("decorator.event", data);
        }
      }

      @Controller("/decorator")
      class DecoratorController {
        constructor(private emitter: EmitterService) { }

        @Post("/emit")
        emit(@Body() body: any) {
          this.emitter.emit(body);
          return { received: receivedData };
        }
      }

      server = await new Server()
        .use(events())
        .load(DecoratorService, EmitterService, DecoratorController)
        .listen(5030);

      baseURL = "http://localhost:5030";

      const response = await fetch(`${baseURL}/decorator/emit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello from decorator" }),
      });
      const data = await response.json();

      expect(data.received).toHaveLength(1);
      expect(data.received[0].message).toBe("Hello from decorator");
    });

    test("multiple @On decorators", async () => {
      const receivedEvents: any[] = [];

      @Service()
      class MultiDecoratorService {
        @On("event.one")
        handleOne(data: any) {
          receivedEvents.push({ type: "one", ...data });
        }

        @On("event.two")
        handleTwo(data: any) {
          receivedEvents.push({ type: "two", ...data });
        }

        @On("event.three")
        handleThree(data: any) {
          receivedEvents.push({ type: "three", ...data });
        }
      }

      @Service()
      class EmitterService {
        @Events() private eventBus: EventEmitter; // Different name

        emitAll() {
          this.eventBus.emit("event.one", { order: 1 });
          this.eventBus.emit("event.two", { order: 2 });
          this.eventBus.emit("event.three", { order: 3 });
        }
      }

      @Controller("/multi")
      class MultiController {
        constructor(private emitter: EmitterService) { }

        @Get("/emit")
        emit() {
          this.emitter.emitAll();
          return { events: receivedEvents };
        }
      }

      server = await new Server()
        .use(events())
        .load(MultiDecoratorService, EmitterService, MultiController)
        .listen(5031);

      baseURL = "http://localhost:5031";

      const response = await fetch(`${baseURL}/multi/emit`);
      const data = await response.json();

      expect(data.events).toHaveLength(3);
      expect(data.events.map((e: any) => e.type)).toEqual(["one", "two", "three"]);
    });
  });

  // ==========================================
  // LISTENER INFO METHODS
  // ==========================================

  describe("Listener Info Methods", () => {
    test("hasListeners with notify property", async () => {
      @Service()
      class TestService {
        @Events() private notify: EventEmitter; // Different name

        constructor() {
          this.notify.on("has-listener", () => { });
        }

        hasListener(event: string) {
          return this.notify.hasListeners(event);
        }
      }

      @Controller("/info")
      class InfoController {
        constructor(private testService: TestService) { }

        @Get("/has/:event")
        hasListener(@Params("event") event: string) {
          return { has: this.testService.hasListener(event) };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, InfoController)
        .listen(5045);

      baseURL = "http://localhost:5045";

      let response = await fetch(`${baseURL}/info/has/has-listener`);
      let data = await response.json();
      expect(data.has).toBe(true);

      response = await fetch(`${baseURL}/info/has/no-listener`);
      data = await response.json();
      expect(data.has).toBe(false);
    });

    test("listenerCount", async () => {
      @Service()
      class TestService {
        @Events() private events: EventEmitter;

        constructor() {
          this.events.on("counted-event", () => { });
          this.events.on("counted-event", () => { });
          this.events.on("counted-event", () => { });
        }

        getCount(event: string) {
          return this.events.listenerCount(event);
        }
      }

      @Controller("/info")
      class InfoController {
        constructor(private testService: TestService) { }

        @Get("/count/:event")
        getCount(@Params("event") event: string) {
          return { count: this.testService.getCount(event) };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, InfoController)
        .listen(5046);

      baseURL = "http://localhost:5046";

      let response = await fetch(`${baseURL}/info/count/counted-event`);
      let data = await response.json();
      expect(data.count).toBe(3);
    });

    test("eventNames with track property", async () => {
      @Service()
      class TestService {
        @Events() private track: EventEmitter; // Different name

        constructor() {
          this.track.on("event-alpha", () => { });
          this.track.on("event-beta", () => { });
          this.track.on("event-gamma", () => { });
        }

        getEventNames() {
          return this.track.eventNames();
        }
      }

      @Controller("/info")
      class InfoController {
        constructor(private testService: TestService) { }

        @Get("/names")
        getNames() {
          return { names: this.testService.getEventNames() };
        }
      }

      server = await new Server()
        .use(events())
        .load(TestService, InfoController)
        .listen(5042);

      baseURL = "http://localhost:5042";

      const response = await fetch(`${baseURL}/info/names`);
      const data = await response.json();

      expect(data.names).toContain("event-alpha");
      expect(data.names).toContain("event-beta");
      expect(data.names).toContain("event-gamma");
    });
  });

  // ==========================================
  // UNREGISTER & CLEAR (NEEDS FULL SERVICE)
  // ==========================================

  describe("Advanced Operations with Constructor Injection", () => {
    test("unregisterProviderEvents", async () => {
      const calls: string[] = [];

      @Service()
      class UnregisterableService {
        @On("unregister.event")
        handler() {
          calls.push("called");
        }
      }

      @Service()
      class ControlService {
        constructor(@Inject(EventService) private events: EventService) { } // Need full service

        emit() {
          this.events.emit("unregister.event", {});
        }

        unregister() {
          this.events.unregisterProviderEvents(UnregisterableService);
        }
      }

      @Controller("/unregister")
      class UnregisterController {
        constructor(private controlService: ControlService) { }

        @Get("/emit")
        emit() {
          this.controlService.emit();
          return { calls: calls.length };
        }

        @Post("/unregister")
        unregister() {
          this.controlService.unregister();
          return { message: "Unregistered" };
        }
      }

      server = await new Server()
        .use(events())
        .load(UnregisterableService, ControlService, UnregisterController)
        .listen(5060);

      baseURL = "http://localhost:5060";

      await fetch(`${baseURL}/unregister/emit`);
      let response = await fetch(`${baseURL}/unregister/emit`);
      let data = await response.json();
      expect(data.calls).toBe(2);

      await fetch(`${baseURL}/unregister/unregister`, { method: "POST" });

      response = await fetch(`${baseURL}/unregister/emit`);
      data = await response.json();
      expect(data.calls).toBe(2);
    });

    test("clear removes all handlers", async () => {
      const calls: string[] = [];

      @Service()
      class ClearableService {
        @On("clear.event")
        handler() {
          calls.push("called");
        }
      }

      @Service()
      class ControlService {
        constructor(@Inject(EventService) private events: EventService) { } // Need full service

        emit() {
          this.events.emit("clear.event", {});
        }

        clear() {
          this.events.clear();
        }

        getStats() {
          return this.events.getStats();
        }
      }

      @Controller("/clear")
      class ClearController {
        constructor(private controlService: ControlService) { }

        @Get("/emit")
        emit() {
          this.controlService.emit();
          return { calls: calls.length };
        }

        @Post("/clear")
        clear() {
          this.controlService.clear();
          return { message: "Cleared" };
        }

        @Get("/stats")
        getStats() {
          return this.controlService.getStats();
        }
      }

      server = await new Server()
        .use(events())
        .load(ClearableService, ControlService, ClearController)
        .listen(5070);

      baseURL = "http://localhost:5070";

      let response = await fetch(`${baseURL}/clear/emit`);
      let data = await response.json();
      expect(data.calls).toBe(1);

      await fetch(`${baseURL}/clear/clear`, { method: "POST" });

      response = await fetch(`${baseURL}/clear/stats`);
      data = await response.json();
      expect(data.totalProviders).toBe(0);
    });
  });

  // ==========================================
  // REAL-WORLD SCENARIOS
  // ==========================================

  describe("Real-World Scenarios", () => {
    test("user registration workflow", async () => {
      const auditLog: string[] = [];
      const emailsSent: any[] = [];
      const analyticsEvents: any[] = [];

      @Service()
      class AuditService {
        @On("user.registered")
        logRegistration(user: any) {
          auditLog.push(`User registered: ${user.email}`);
        }
      }

      @Service()
      class EmailService {
        @On("user.registered")
        async sendWelcomeEmail(user: any) {
          await new Promise((r) => setTimeout(r, 10));
          emailsSent.push({ to: user.email, template: "welcome" });
        }
      }

      @Service()
      class AnalyticsService {
        @On("user.registered")
        trackRegistration(user: any) {
          analyticsEvents.push({ event: "signup", userId: user.id });
        }
      }

      @Service()
      class UserService {
        @Events() private notify: EventEmitter; // Using decorator

        async registerUser(email: string) {
          const user = { id: Date.now(), email };
          await this.notify.emitAsync("user.registered", user);
          return user;
        }
      }

      @Controller("/users")
      class UserController {
        constructor(private userService: UserService) { }

        @Post("/register")
        async register(@Body() body: { email: string }) {
          const user = await this.userService.registerUser(body.email);
          return {
            user,
            auditLog: [...auditLog],
            emailsSent: [...emailsSent],
            analyticsEvents: [...analyticsEvents],
          };
        }
      }

      server = await new Server()
        .use(events())
        .load(AuditService, EmailService, AnalyticsService, UserService, UserController)
        .listen(5100);

      baseURL = "http://localhost:5100";

      const response = await fetch(`${baseURL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      const data = await response.json();

      expect(data.auditLog).toContain("User registered: test@example.com");
      expect(data.emailsSent[0].template).toBe("welcome");
      expect(data.analyticsEvents[0].event).toBe("signup");
    });

    test("order processing event chain", async () => {
      const processSteps: string[] = [];

      @Service()
      class InventoryService {
        constructor(@Inject(EventService) private events: EventService) { } // Traditional way for emitting

        @On("order.placed")
        async reserveInventory(order: any) {
          await new Promise((r) => setTimeout(r, 5));
          processSteps.push("inventory_reserved");
          this.events.emit("inventory.reserved", order);
        }
      }

      @Service()
      class PaymentService {
        @Events() private track: EventEmitter; // Decorator way

        @On("inventory.reserved")
        async processPayment(order: any) {
          await new Promise((r) => setTimeout(r, 5));
          processSteps.push("payment_processed");
          this.track.emit("payment.completed", order);
        }
      }

      @Service()
      class ShippingService {
        @On("payment.completed")
        async scheduleShipment(order: any) {
          await new Promise((r) => setTimeout(r, 5));
          processSteps.push("shipment_scheduled");
        }
      }

      @Service()
      class OrderService {
        @Events() private events: EventEmitter; // Decorator way

        async placeOrder(items: string[]) {
          const order = { id: Date.now(), items };
          await this.events.emitAsync("order.placed", order);
          return order;
        }
      }

      @Controller("/orders")
      class OrderController {
        constructor(private orderService: OrderService) { }

        @Post("/")
        async placeOrder(@Body() body: { items: string[] }) {
          const order = await this.orderService.placeOrder(body.items);
          await new Promise((r) => setTimeout(r, 50));
          return { order, steps: [...processSteps] };
        }
      }

      server = await new Server()
        .use(events())
        .load(InventoryService, PaymentService, ShippingService, OrderService, OrderController)
        .listen(5101);

      baseURL = "http://localhost:5101";

      const response = await fetch(`${baseURL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: ["item1", "item2"] }),
      });
      const data = await response.json();

      expect(data.steps).toContain("inventory_reserved");
      expect(data.steps).toContain("payment_processed");
      expect(data.steps).toContain("shipment_scheduled");
    });

    test("cache invalidation pattern", async () => {
      const cache = new Map<string, any>();
      const cacheInvalidations: string[] = [];

      @Service()
      class CacheService {
        @On("product.updated")
        invalidateProduct(data: { productId: string }) {
          cache.delete(`product:${data.productId}`);
          cacheInvalidations.push(`product:${data.productId}`);
        }

        get(key: string) {
          return cache.get(key);
        }

        set(key: string, value: any) {
          cache.set(key, value);
        }
      }

      @Service()
      class ProductService {
        @Events() private notify: EventEmitter; // Decorator way

        constructor(private cacheService: CacheService) { }

        getProduct(id: string) {
          const cached = this.cacheService.get(`product:${id}`);
          if (cached) return { ...cached, fromCache: true };

          const product = { id, name: `Product ${id}`, price: 100 };
          this.cacheService.set(`product:${id}`, product);
          return { ...product, fromCache: false };
        }

        updateProduct(id: string, updates: any) {
          this.notify.emit("product.updated", { productId: id });
          return { id, ...updates };
        }
      }

      @Controller("/products")
      class ProductController {
        constructor(private productService: ProductService) { }

        @Get("/:id")
        getProduct(@Params("id") id: string) {
          return this.productService.getProduct(id);
        }

        @Post("/:id")
        updateProduct(@Params("id") id: string, @Body() body: any) {
          return this.productService.updateProduct(id, body);
        }

        @Get("/debug/invalidations")
        getInvalidations() {
          return { invalidations: cacheInvalidations };
        }
      }

      server = await new Server()
        .use(events())
        .load(CacheService, ProductService, ProductController)
        .listen(5102);

      baseURL = "http://localhost:5102";

      let response = await fetch(`${baseURL}/products/123`);
      let data = await response.json();
      expect(data.fromCache).toBe(false);

      response = await fetch(`${baseURL}/products/123`);
      data = await response.json();
      expect(data.fromCache).toBe(true);

      await fetch(`${baseURL}/products/123`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Product" }),
      });

      response = await fetch(`${baseURL}/products/123`);
      data = await response.json();
      expect(data.fromCache).toBe(false);

      response = await fetch(`${baseURL}/products/debug/invalidations`);
      data = await response.json();
      expect(data.invalidations).toContain("product:123");
    });
  });
});
