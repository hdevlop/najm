import 'reflect-metadata';
import { afterEach, expect, test } from 'bun:test';
import { Controller, Get, Server, Service } from 'najm-core';
import { database, Transaction, TransactionService, type DatabasePluginOptions } from '../src';

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await server.stop(); });

async function fixture(options: DatabasePluginOptions, events: string[]) {
  const db = { async transaction<T>(work: (tx: any) => Promise<T>) {
    events.push('begin');
    try { const result = await work({ marker: 'transaction' }); events.push('commit'); return result; }
    catch (error) { events.push('rollback'); throw error; }
  } };
  @Service()
  class Domain {
    constructor(private transactions: TransactionService) {}
    @Transaction({ retries: 1 })
    async write() {
      events.push('domain');
      expect(this.transactions.getActive()).toMatchObject({ marker: 'transaction' });
      await this.nested();
      return 'saved';
    }
    @Transaction()
    async nested() { events.push('nested'); }
  }
  @Controller('/entry')
  class Entry {
    constructor(private domain: Domain) {}
    @Get()
    run() { return this.domain.write(); }
  }
  const server = new Server({ isolated: true, silent: true }).use(database(db, options)).load({ Domain, Entry });
  servers.push(server); await server.init();
  return () => server.fetch(new Request('http://fixture/entry'));
}

test('transaction entry runs before domain work with active injection and not again for nested calls', async () => {
  const events: string[] = [];
  const request = await fixture({ beforeTransaction: async (tx, name) => { expect(tx.marker).toBe('transaction'); expect(name).toBe('default'); events.push('order'); } }, events);
  expect((await request()).status).toBe(200);
  expect(events).toEqual(['begin', 'order', 'domain', 'nested', 'commit']);
});

test('a failed transaction entry prevents domain work and rolls back', async () => {
  const events: string[] = [];
  const request = await fixture({ beforeTransaction: async () => { events.push('order'); throw Error('lock unavailable'); } }, events);
  expect((await request()).status).toBe(500);
  expect(events).toEqual(['begin', 'order', 'rollback']);
});

test('retry acquires entry ordering again before the next attempt', async () => {
  const events: string[] = []; let attempts = 0;
  const request = await fixture({ beforeTransaction: async () => { events.push('order'); if (!attempts++) throw Object.assign(Error('serialization'), { code: '40001' }); } }, events);
  expect((await request()).status).toBe(200);
  expect(events).toEqual(['begin', 'order', 'rollback', 'begin', 'order', 'domain', 'nested', 'commit']);
});
