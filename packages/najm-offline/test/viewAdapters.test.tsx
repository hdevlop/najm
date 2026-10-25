import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs } from 'najm-kit';
import { User } from 'lucide-react';
import { NStatCard, ReadCoverageContext, TabsContent } from '../src/shell/kit';

const coverage = { panels: new Set(['overview']), unavailableStatisticLabels: new Set(['Fees']), unavailableText: 'Not downloaded' };
test('public Kit adapter does not mount an uncovered panel, and preserves covered content', () => {
  function PrivatePanel(): never { throw new Error('An unsupported panel must never execute'); }
  const unsupported = renderToStaticMarkup(<ReadCoverageContext.Provider value={coverage}><Tabs value="fees">
    <TabsContent value="fees"><PrivatePanel /></TabsContent>
  </Tabs></ReadCoverageContext.Provider>);
  expect(unsupported).toContain('Not downloaded');
  const overview = renderToStaticMarkup(<ReadCoverageContext.Provider value={coverage}><Tabs value="overview">
    <TabsContent value="overview">Real downloaded identity</TabsContent>
  </Tabs></ReadCoverageContext.Provider>);
  expect(overview).toContain('Real downloaded identity');
});
test('an unavailable statistic never renders a fabricated zero; an available identity fact is preserved', () => {
  const html = renderToStaticMarkup(<ReadCoverageContext.Provider value={coverage}>
    <NStatCard variant="compact" icon={User} label="Fees" value="FAKE_ZERO" />
    <NStatCard variant="compact" icon={User} label="Age" value="17 years" />
  </ReadCoverageContext.Provider>);
  expect(html).not.toContain('FAKE_ZERO');
  expect(html).toContain('—');
  expect(html).toContain('17 years');
  const online = renderToStaticMarkup(<NStatCard variant="compact" icon={User} label="Fees" value="123" />);
  expect(online).toContain('123');
});
