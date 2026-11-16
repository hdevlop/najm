import { describe, test, expect } from 'bun:test';
import { ASSISTANT_NAV_ID, buildNavItems } from '../../src/studio-ui/features/dashboard/hooks/useNavItems';

describe('studio sidebar', () => {
  test('the Studio Assistant opens from a sidebar item, not a button floating over table footers', () => {
    const ids = buildNavItems({ enableKnowledge: false, unmatchedCount: 0, assistant: true }).map((item) => item.id);
    expect(ids.at(-1)).toBe(ASSISTANT_NAV_ID);
  });

  test('screens without assistant tools get no Assistant item', () => {
    const ids = buildNavItems({ enableKnowledge: false, unmatchedCount: 0, assistant: false }).map((item) => item.id);
    expect(ids).not.toContain(ASSISTANT_NAV_ID);
  });
});
