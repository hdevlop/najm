import 'reflect-metadata';
import { afterEach, describe, expect, test, spyOn } from 'bun:test';
import { HTTPException } from 'hono/http-exception';
import { BaseError, Controller, Err, Get, Server } from '../src';

const originalEnvironment = process.env.NODE_ENV;
let logging: ReturnType<typeof spyOn> | undefined;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment;
  logging?.mockRestore();
});

describe('production error responses', () => {
  test('unexpected failures are private while the original error reaches server logs', async () => {
    process.env.NODE_ENV = 'production';
    logging = spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('PRIVATE_INTERNAL_MARKER /srv/private/database');
    class Probe { fail() { throw failure; } }
    Controller('/production-error')(Probe);
    Get('/fail')(Probe.prototype, 'fail', Object.getOwnPropertyDescriptor(Probe.prototype, 'fail')!);
    const server = new Server({ isolated: true, silent: true }).load(Probe);
    try {
      const response = await server.fetch(new Request('http://localhost/production-error/fail'));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ code: 'HTTP_500', message: 'Internal Server Error', status: 500 });
      expect(logging).toHaveBeenCalledWith('[najm/core] Internal server error', failure);
    } finally { await server.stop(); }
  });

  test('typed and transport server errors hide their details and preserve status', async () => {
    process.env.NODE_ENV = 'production';
    logging = spyOn(console, 'error').mockImplementation(() => {});
    for (const failure of [new BaseError('DB_001', 'private database detail', 500), new HTTPException(503, { message: 'private upstream detail' })]) {
      const response = Err.handle(failure);
      expect(response.status).toBe(failure.status);
      expect(await response.text()).not.toContain('private');
    }
  });

  test('client errors keep their actionable message without logging a server failure', async () => {
    process.env.NODE_ENV = 'production';
    logging = spyOn(console, 'error').mockImplementation(() => {});
    const response = Err.handle(new BaseError('HTTP_409', 'Email already exists', 409));
    expect(response.status).toBe(409);
    expect((await response.json()).message).toBe('Email already exists');
    expect(logging).not.toHaveBeenCalled();
  });

  test('development keeps debugging detail', async () => {
    process.env.NODE_ENV = 'development';
    expect((await Err.handle(new Error('debug detail')).json()).message).toBe('debug detail');
  });
});
