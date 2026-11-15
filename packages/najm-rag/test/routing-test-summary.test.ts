import { describe, test, expect } from 'bun:test';
import { RoutingTestsService } from '../src/routingTests/RoutingTestsService';

function row(lang: string, lastStatus: string) {
  return { id: `${lang}-${Math.random()}`, name: 'n', query: 'q', lang, expectedTools: ['t'], lastStatus } as any;
}

describe('DR0: routing test results per language', () => {
  test('the summary gives a pass rate overall and for each language, ignoring tests not yet run', async () => {
    const service = new RoutingTestsService();
    (service as any).repository = {
      list: async () => [
        row('darija', 'pass'), row('darija', 'fail'), row('darija', 'low_confidence'), row('darija', 'pending'),
        row('darija-latn', 'fail'), row('en', 'pass'), row('en', 'pass'),
      ],
    };

    const summary = await service.summary();

    expect(summary.total).toEqual({ run: 6, passed: 3, passRate: 0.5, pending: 1 });
    expect(summary.byLang.darija).toEqual({ run: 3, passed: 1, passRate: 1 / 3, pending: 1 });
    expect(summary.byLang['darija-latn']).toEqual({ run: 1, passed: 0, passRate: 0, pending: 0 });
    expect(summary.byLang.en).toEqual({ run: 2, passed: 2, passRate: 1, pending: 0 });
  });

  test('a language with nothing run has no pass rate', async () => {
    const service = new RoutingTestsService();
    (service as any).repository = { list: async () => [row('fr', 'pending')] };
    expect((await service.summary()).byLang.fr).toEqual({ run: 0, passed: 0, passRate: null, pending: 1 });
  });
});
