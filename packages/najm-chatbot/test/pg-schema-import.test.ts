import { expect, test } from 'bun:test';

test('PostgreSQL chatbot tables can be imported without a RAG deprecation warning', () => {
  const schemaUrl = new URL('../src/schema/pg.ts', import.meta.url).href;
  const result = Bun.spawnSync({
    cmd: [process.execPath, '--eval', `
      delete process.env.NAJM_NO_DEPRECATION_WARNINGS;
      const { aiSettingsTable, chatSessionsTable } = await import(${JSON.stringify(schemaUrl)});
      if (!aiSettingsTable.id || !chatSessionsTable.id) throw new Error('Missing chatbot tables');
    `],
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).not.toContain('[najm-chatbot deprecation]');
});
