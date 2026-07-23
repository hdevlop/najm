import "reflect-metadata";
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Server } from "najm-core";
import { cors } from "najm-cors";
import { Controller, reset, Service } from "najm-core";
import { Get, Post, Body } from "najm-core";

// ==========================================
// TEST FIXTURES - CONTROLLERS & SERVICES
// ==========================================
@Controller('/api')
class TestController {
  @Get('/data')
  getData() {
    return { message: 'Hello World' };
  }

  @Post('/create')
  createData(@Body() body: any) {
    return { id: 1, ...body };
  }
}

@Controller('/api/v1')
class V1Controller {
  @Get('/users')
  getUsers() {
    return [{ id: 1, name: 'John' }];
  }
}

@Controller('/api/v2')
class V2Controller {
  @Get('/posts')
  getPosts() {
    return [{ id: 1, title: 'Post 1' }];
  }
}

@Service()
class DataService {
  getData() {
    return { value: 42, source: 'service' };
  }
}

@Controller('/api')
class ServiceController {
  constructor(private dataService: DataService) { }

  @Get('/service-data')
  getServiceData() {
    return this.dataService.getData();
  }
}

// ==========================================
// TEST SUITE
// ==========================================

describe("CORS Integration Tests", () => {
  let server: Server;
  let baseURL: string;

  beforeEach(async () => {
    await reset();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  // ==========================================
  // CORS DISABLED TESTS
  // ==========================================

  test("does not add CORS headers when CORS is not configured", async () => {
    server = await new Server()
      .load(TestController)
      .listen(3100);

    baseURL = 'http://localhost:3100';
    const response = await fetch(`${baseURL}/api/data`);
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('access-control-allow-methods')).toBeNull();
  });

  // ==========================================
  // CORS ENABLED WITH DEFAULTS
  // ==========================================

  test("adds default CORS headers when enabled without options", async () => {
    server = await new Server()
      .use(cors())
      .load(TestController)
      .listen(3102);

    baseURL = 'http://localhost:3102';

    const response = await fetch(`${baseURL}/api/data`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  // ==========================================
  // CUSTOM ORIGIN TESTS
  // ==========================================

  test("allows requests from specific origin", async () => {
    server = await new Server()
      .use(cors({ origin: 'https://example.com' }))
      .load(TestController)
      .listen(3103);

    baseURL = 'http://localhost:3103';

    const response = await fetch(`${baseURL}/api/data`, {
      headers: {
        'Origin': 'https://example.com'
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
  });

  test("allows requests from wildcard origin", async () => {
    server = await new Server()
      .use(cors({ origin: '*', credentials: false }))
      .load(TestController)
      .listen(3104);

    baseURL = 'http://localhost:3104';

    const response = await fetch(`${baseURL}/api/data`, {
      headers: {
        'Origin': 'https://any-domain.com'
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  test("allows requests from multiple origin", async () => {
    server = await new Server()
      .use(cors({ origin: ['https://app.example.com', 'https://admin.example.com'] }))
      .load(TestController)
      .listen(3105);

    baseURL = 'http://localhost:3105';

    // Test first allowed origin
    const response1 = await fetch(`${baseURL}/api/data`, {
      headers: {
        'Origin': 'https://app.example.com'
      }
    });
    expect(response1.headers.get('access-control-allow-origin')).toBe('https://app.example.com');

    // Test second allowed origin
    const response2 = await fetch(`${baseURL}/api/data`, {
      headers: {
        'Origin': 'https://admin.example.com'
      }
    });
    expect(response2.headers.get('access-control-allow-origin')).toBe('https://admin.example.com');
  });

  // ==========================================
  // HTTP METHODS TESTS
  // ==========================================

  test("allows specified HTTP methods", async () => {
    server = await new Server()
      .use(cors({ origin: '*', allowMethods: ['GET', 'POST', 'DELETE'] }))
      .load(TestController)
      .listen(3106);

    baseURL = 'http://localhost:3106';

    // Preflight request
    const response = await fetch(`${baseURL}/api/data`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      }
    });

    const allowedMethods = response.headers.get('access-control-allow-methods');
    expect(allowedMethods).toContain('GET');
    expect(allowedMethods).toContain('POST');
    expect(allowedMethods).toContain('DELETE');
  });

  test("handles preflight OPTIONS request", async () => {
    server = await new Server()
      .use(cors({
        origin: 'https://example.com',
        allowMethods: ['GET', 'POST'],
        allowHeaders: ['Content-Type', 'Authorization'],
      }))
      .load(TestController)
      .listen(3107);

    baseURL = 'http://localhost:3107';

    const response = await fetch(`${baseURL}/api/create`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  // ==========================================
  // CREDENTIALS TESTS
  // ==========================================

  test("includes credentials header when enabled", async () => {
    server = await new Server()
      .use(cors({ origin: 'https://example.com', credentials: true }))
      .load(TestController)
      .listen(3108);

    baseURL = 'http://localhost:3108';

    const response = await fetch(`${baseURL}/api/data`, {
      headers: {
        'Origin': 'https://example.com',
        'Cookie': 'session=abc123'
      }
    });

    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  test("omits credentials header when disabled", async () => {
    server = await new Server()
      .use(cors({ origin: 'https://example.com', credentials: false }))
      .load(TestController)
      .listen(3109);

    baseURL = 'http://localhost:3109';

    const response = await fetch(`${baseURL}/api/data`, {
      headers: {
        'Origin': 'https://example.com'
      }
    });

    expect(response.headers.get('access-control-allow-credentials')).not.toBe('true');
  });

  // ==========================================
  // HEADERS TESTS
  // ==========================================

  test("allows custom request headers", async () => {
    server = await new Server()
      .use(cors({
        origin: '*',
        allowHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
      }))
      .load(TestController)
      .listen(3110);

    baseURL = 'http://localhost:3110';

    const response = await fetch(`${baseURL}/api/data`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-Custom-Header',
      }
    });

    const allowedHeaders = response.headers.get('access-control-allow-headers');
    expect(allowedHeaders).toContain('X-Custom-Header');
  });

  test("exposes custom response headers", async () => {
    server = await new Server()
      .use(cors({ origin: '*', exposeHeaders: ['X-Total-Count', 'X-Page-Number'] }))
      .load(TestController)
      .listen(3111);

    baseURL = 'http://localhost:3111';

    const response = await fetch(`${baseURL}/api/data`, {
      headers: {
        'Origin': 'https://example.com'
      }
    });

    const exposedHeaders = response.headers.get('access-control-expose-headers');
    expect(exposedHeaders).toContain('X-Total-Count');
    expect(exposedHeaders).toContain('X-Page-Number');
  });

  // ==========================================
  // MAX AGE TESTS
  // ==========================================

  test("sets max-age for preflight cache", async () => {
    server = await new Server()
      .use(cors({ origin: '*', maxAge: 3600 })) // 1 hour
      .load(TestController)
      .listen(3112);

    baseURL = 'http://localhost:3112';

    const response = await fetch(`${baseURL}/api/data`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      }
    });

    expect(response.headers.get('access-control-max-age')).toBe('3600');
  });

  // ==========================================
  // ACTUAL REQUEST TESTS (POST with body)
  // ==========================================

  test("handles POST request with CORS", async () => {
    server = await new Server()
      .use(cors({
        origin: 'https://example.com',
        allowMethods: ['POST'],
        allowHeaders: ['Content-Type'],
      }))
      .load(TestController)
      .listen(3113);

    baseURL = 'http://localhost:3113';

    const response = await fetch(`${baseURL}/api/create`, {
      method: 'POST',
      headers: {
        'Origin': 'https://example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Test Item' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');

    const data = await response.json();
    expect(data.name).toBe('Test Item');
  });

  // ==========================================
  // ERROR HANDLING TESTS
  // ==========================================

  test("throws error during server start with invalid origin URL", async () => {
    await expect(async () => {
      server = await new Server()
        .use(cors({ origin: 'not-a-valid-url' }))
        .load(TestController)
        .listen(3114);
    }).toThrow();
  });

  test("throws error during server start when origin is empty string", async () => {
    await expect(async () => {
      server = await new Server()
        .use(cors({ origin: '' }))
        .load(TestController)
        .listen(3115);
    }).toThrow();
  });

  // ==========================================
  // EDGE CASES
  // ==========================================

  test("handles requests without origin header", async () => {
    server = await new Server()
      .use(cors({ origin: 'https://example.com' }))
      .load(TestController)
      .listen(3116);

    baseURL = 'http://localhost:3116';

    // Request without Origin header (e.g., same-origin request)
    const response = await fetch(`${baseURL}/api/data`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('Hello World');
  });

  test("applies CORS to all routes with wildcard path", async () => {
    server = await new Server()
      .use(cors({ origin: '*' }))
      .load(V1Controller, V2Controller)
      .listen(3117);

    baseURL = 'http://localhost:3117';

    // Test CORS on different routes
    const response1 = await fetch(`${baseURL}/api/v1/users`, {
      headers: { 'Origin': 'https://example.com' }
    });
    expect(response1.headers.get('access-control-allow-origin')).toBe('*');

    const response2 = await fetch(`${baseURL}/api/v2/posts`, {
      headers: { 'Origin': 'https://example.com' }
    });
    expect(response2.headers.get('access-control-allow-origin')).toBe('*');
  });

  // ==========================================
  // INTEGRATION WITH SERVICES
  // ==========================================

  test("CORS works with services and dependency injection", async () => {
    server = await new Server()
      .use(cors({ origin: 'https://example.com' }))
      .load(DataService, ServiceController)
      .listen(3118);

    baseURL = 'http://localhost:3118';

    const response = await fetch(`${baseURL}/api/service-data`, {
      headers: {
        'Origin': 'https://example.com'
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://example.com');

    const data = await response.json();
    expect(data.value).toBe(42);
    expect(data.source).toBe('service');
  });
});