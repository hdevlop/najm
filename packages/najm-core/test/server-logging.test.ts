import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { LoggerService, Server } from '../dist/index.mjs';

describe('Server startup logging', () => {
  let originalServe: typeof Bun.serve;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLogFormat = process.env.LOG_FORMAT;
  const originalNoColor = process.env.NO_COLOR;

  beforeEach(() => {
    originalServe = Bun.serve;
  });

  afterEach(() => {
    Bun.serve = originalServe;
    restoreEnv('NODE_ENV', originalNodeEnv);
    restoreEnv('LOG_FORMAT', originalLogFormat);
    restoreEnv('NO_COLOR', originalNoColor);
  });

  test('logs startup + dev info with icons in development mode', async () => {
    Bun.serve = (() => ({
      port: 4321,
      stop: () => {},
    })) as unknown as typeof Bun.serve;

    const server = new Server().base('/api');
    (server as any).ensureInitialized = async () => {};

    const events: string[] = [];
    const infoMessages: string[] = [];

    (server as any).logger = {
      serverStarted: (port: number) => events.push(`started:${port}`),
      serverStopped: () => events.push('stopped'),
      serverError: () => events.push('error'),
      info: (message: string) => infoMessages.push(message),
    };

    process.env.NODE_ENV = 'development';

    await server.listen(0);
    await server.stop();

    expect(events).toContain('started:4321');
    expect(events).toContain('stopped');
    expect(
      infoMessages.some((message) =>
        message.includes('🎨 Development mode active at http://localhost:4321'),
      ),
    ).toBe(true);
    expect(
      infoMessages.some((message) => message.includes('📚 API base: http://localhost:4321/api')),
    ).toBe(true);
  });

  test('skips dev info logs when silent mode is enabled', async () => {
    Bun.serve = (() => ({
      port: 3000,
      stop: () => {},
    })) as unknown as typeof Bun.serve;

    const server = new Server({ silent: true }).base('/api');
    (server as any).ensureInitialized = async () => {};

    const events: string[] = [];
    const infoMessages: string[] = [];

    (server as any).logger = {
      serverStarted: (port: number) => events.push(`started:${port}`),
      serverStopped: () => events.push('stopped'),
      serverError: () => events.push('error'),
      info: (message: string) => infoMessages.push(message),
    };

    process.env.NODE_ENV = 'development';

    await server.listen(0);
    await server.stop();

    expect(events).toContain('started:3000');
    expect(infoMessages.length).toBe(0);
  });

  test('init initializes without binding a port', async () => {
    let serveCalled = false;
    Bun.serve = (() => {
      serveCalled = true;
      return {
        port: 3000,
        stop: () => {},
      };
    }) as unknown as typeof Bun.serve;

    const server = new Server();
    (server as any).ensureInitialized = async () => {};

    const result = await server.init();

    expect(result).toBe(server);
    expect(serveCalled).toBe(false);
    expect(server.isRunning).toBe(false);
    expect(server.port).toBeUndefined();
  });

  test('listen uses configured port when omitted', async () => {
    let capturedPort: number | undefined;

    Bun.serve = ((opts: { port: number; fetch: (req: Request) => Promise<Response> }) => {
      capturedPort = opts.port;
      return {
        port: opts.port,
        stop: () => {},
      };
    }) as unknown as typeof Bun.serve;

    const server = new Server({ port: 4545, silent: true });
    (server as any).ensureInitialized = async () => {};

    await server.listen();
    await server.stop();

    expect(capturedPort).toBe(4545);
  });

  test('listen parses configured string port when omitted', async () => {
    let capturedPort: number | undefined;

    Bun.serve = ((opts: { port: number; fetch: (req: Request) => Promise<Response> }) => {
      capturedPort = opts.port;
      return {
        port: opts.port,
        stop: () => {},
      };
    }) as unknown as typeof Bun.serve;

    const server = new Server({ port: '4547', silent: true });
    (server as any).ensureInitialized = async () => {};

    await server.listen();
    await server.stop();

    expect(capturedPort).toBe(4547);
  });

  test('listen parses string port argument', async () => {
    let capturedPort: number | undefined;

    Bun.serve = ((opts: { port: number; fetch: (req: Request) => Promise<Response> }) => {
      capturedPort = opts.port;
      return {
        port: opts.port,
        stop: () => {},
      };
    }) as unknown as typeof Bun.serve;

    const server = new Server({ silent: true });
    (server as any).ensureInitialized = async () => {};

    await server.listen('4548');
    await server.stop();

    expect(capturedPort).toBe(4548);
  });

  test('listen rejects invalid string port', async () => {
    let serveCalled = false;

    Bun.serve = (() => {
      serveCalled = true;
      return {
        port: 3000,
        stop: () => {},
      };
    }) as unknown as typeof Bun.serve;

    const server = new Server({ silent: true });
    (server as any).ensureInitialized = async () => {};

    await expect(server.listen('abc')).rejects.toThrow('received "abc"');
    expect(serveCalled).toBe(false);
  });

  test('listen accepts callback without explicit port', async () => {
    Bun.serve = (() => ({
      port: 4546,
      stop: () => {},
    })) as unknown as typeof Bun.serve;

    const server = new Server({ port: 4546, silent: true });
    (server as any).ensureInitialized = async () => {};

    let callbackCalled = false;
    await server.listen(() => {
      callbackCalled = true;
    });
    await server.stop();

    expect(callbackCalled).toBe(true);
  });

  test('log queues startup messages from spread or array args', async () => {
    Bun.serve = (() => ({
      port: 4550,
      stop: () => {},
    })) as unknown as typeof Bun.serve;

    const server = new Server({ port: 4550, silent: true });
    (server as any).ensureInitialized = async () => {};

    const infoMessages: string[] = [];
    (server as any).logger = {
      serverStarted: () => {},
      serverStopped: () => {},
      serverError: () => {},
      serverInitializing: () => {},
      serverInitialized: () => {},
      info: (message: string) => infoMessages.push(message),
    };

    await server
      .log('Seed mode', 'ready')
      .log(['Database', { name: 'default' }])
      .listen();

    await server.stop();

    expect(infoMessages).toContain('Seed mode ready');
    expect(infoMessages).toContain('Database {"name":"default"}');
  });

  test('init flushes queued log messages without opening a port', async () => {
    let serveCalled = false;
    Bun.serve = (() => {
      serveCalled = true;
      return {
        port: 3000,
        stop: () => {},
      };
    }) as unknown as typeof Bun.serve;

    const server = new Server({ silent: true });
    (server as any).ensureInitialized = async () => {};

    const infoMessages: string[] = [];
    (server as any).logger = {
      serverStarted: () => {},
      serverStopped: () => {},
      serverError: () => {},
      serverInitializing: () => {},
      serverInitialized: () => {},
      info: (message: string) => infoMessages.push(message),
    };

    await server.log('seeding', { table: 'users' }).init();

    expect(serveCalled).toBe(false);
    expect(infoMessages).toContain('seeding {"table":"users"}');
  });

  test('log writes immediately when server is ready', () => {
    const server = new Server({ silent: true });
    const infoMessages: string[] = [];

    (server as any).state = 'ready';
    (server as any).logger = {
      info: (message: string) => infoMessages.push(message),
    };

    server.log('after listen', { mode: 'playground' });

    expect(infoMessages).toContain('after listen {"mode":"playground"}');
    expect((server as any).startupLogs.length).toBe(0);
  });

  test('logger keeps JSON as the production default format', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_FORMAT;

    const logger = new LoggerService();
    (logger as any).opts = {};
    (logger as any).parseConfig();

    expect(logger.getFormat()).toBe('json');
  });

  test('logger does not emit ANSI colors in production when pretty output is forced', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_FORMAT = 'pretty';
    delete process.env.NO_COLOR;

    const logger = new LoggerService();
    (logger as any).opts = {};
    (logger as any).parseConfig();

    const originalLog = console.log;
    const messages: string[] = [];
    console.log = (message?: unknown) => {
      messages.push(String(message));
    };

    try {
      logger.info('production pretty');
    } finally {
      console.log = originalLog;
    }

    expect(messages[0]).toContain('production pretty');
    expect(messages[0]).not.toContain('\x1b[');
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
