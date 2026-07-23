import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadRagRoutingConfig } from '../src/config/loadRoutingConfig';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'rag-loader-test-'));
}

describe('loadRagRoutingConfig legacy mode migration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(json: object) {
    const path = join(tmpDir, 'routing.json');
    writeFileSync(path, JSON.stringify(json, null, 2), 'utf-8');
    return path;
  }

  test('mode: "routing" enables toolRouting and embedding', () => {
    const path = writeConfig({
      mode: 'routing',
      embedding: { baseUrl: 'http://localhost:11434', model: 'test' },
      maxTools: 5,
    });

    const result = loadRagRoutingConfig(path);

    expect(result.toolRouting?.enabled).toBe(true);
    expect(result.toolRouting?.maxTools).toBe(5);
    expect(result.embedding?.baseUrl).toBe('http://localhost:11434');
    expect(result.indexOnBoot).toBe(true);
  });

  test('mode: "rag" enables embedding without toolRouting', () => {
    const path = writeConfig({
      mode: 'rag',
      embedding: { baseUrl: 'http://localhost:11434', model: 'test' },
    });

    const result = loadRagRoutingConfig(path);

    expect(result.embedding?.baseUrl).toBe('http://localhost:11434');
    expect(result.indexOnBoot).toBe(true);
    expect(result.toolRouting?.enabled).toBeFalsy();
  });

  test('mode: "off" disables toolRouting', () => {
    const path = writeConfig({
      mode: 'off',
    });

    const result = loadRagRoutingConfig(path);

    expect(result.toolRouting?.enabled).toBe(false);
  });

  test('no mode field returns no mode migration', () => {
    const path = writeConfig({
      embedding: { baseUrl: 'http://localhost:11434', model: 'test' },
    });

    const result = loadRagRoutingConfig(path);

    expect(result.toolRouting?.enabled).toBeUndefined();
    expect(result.embedding?.baseUrl).toBe('http://localhost:11434');
  });
});
