import { expect, test } from 'bun:test';
import { canonicalJson, sealOperation, verifyOperation } from '../src/sync/contracts';
import { createCaptureSql } from '../src/sync/captureSql';

test('canonical hashing sorts nested keys and refuses non-JSON coercion/partial data', async () => {
  expect(canonicalJson({ z: [{ b: 2, a: 1 }], a: -0 })).toBe('{"a":0,"z":[{"a":1,"b":2}]}');
  for (const value of [undefined, NaN, Infinity, 1n, new Date(), { x: undefined }, [undefined], Array(2), { get x() { throw Error('getter'); } }]) {
    expect(() => canonicalJson(value)).toThrow('PAYLOAD_INVALID');
  }
  const cycle: any = {}; cycle.self = cycle;
  expect(() => canonicalJson(cycle)).toThrow('PAYLOAD_INVALID');
  const input = { installationId: 'school', installationEpoch: 'epoch', accountId: 'a', deviceId: 'd',
    scope: { kind: 'year' as const, yearLabel: '2026-2027' }, operationId: crypto.randomUUID(), protocolVersion: 1 as const,
    hashFormat: 'fixture-json-v1-sha256', dependencies: [], createdAtClient: '2026-10-19T00:00:00.000Z', intent: { z: 2, a: 1 } };
  const a = await sealOperation(input);
  const b = await sealOperation({ ...input, intent: { a: 1, z: 2 } });
  expect(a.payloadHash).toBe(b.payloadHash);
  a.intent.a = 3;
  await expect(verifyOperation(a, input.hashFormat)).rejects.toThrow('OPERATION_HASH_MISMATCH');
  await expect(verifyOperation(b, 'other-format')).rejects.toThrow('PROTOCOL_UNSUPPORTED');
});

test('capture SQL accepts only reviewed identifiers and explicit projections', () => {
  const options = { installationId: "school's-id", tables: [{ table: 'attendance', entity: 'attendance', keyColumn: 'id', yearColumn: 'academic_year_id', projection: { status: 'status' } }] };
  const sql = createCaptureSql(options);
  expect(sql).toContain("'school''s-id'");
  expect(sql).toContain('AFTER INSERT OR UPDATE OR DELETE');
  expect(sql).toContain('BEFORE INSERT OR UPDATE OR DELETE');
  expect(sql).toContain('BEFORE TRUNCATE');
  expect(sql).not.toContain('SECURITY DEFINER');
  expect(() => createCaptureSql({ ...options, tables: [{ ...options.tables[0], table: 'attendance;DROP TABLE users' }] })).toThrow();
  expect(() => createCaptureSql({ ...options, tables: [{ ...options.tables[0], projection: {} }] })).toThrow();
  expect(() => createCaptureSql({ ...options, tables: [...options.tables, ...options.tables] })).toThrow();
});
