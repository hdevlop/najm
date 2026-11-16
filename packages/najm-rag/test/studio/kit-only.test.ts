import { describe, test, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dir, '../../src/studio-ui');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? tsxFiles(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

describe('RAG Studio uses najm-kit controls', () => {
  test('no raw <button>, <input>, <select>, <textarea> or <table> (hidden file inputs excepted)', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(root)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/<(button|input|select|textarea|table)(\s|>|$)/.test(line) && !/type="file"/.test(line)) {
          offenders.push(`${relative(root, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
