'use client';

import { useTranslation } from 'najm-i18n/react';
import {
  NButton,
  NEmptyState,
  NErrorState,
  NForbiddenState,
  NLoadingState,
  NNotFoundState,
} from 'najm-kit';

/**
 * Acceptance harness for direct `najm-i18n/react` use.
 *
 * This app has no i18n wrapper hook, no nested-lookup helper, no
 * interpolation helper, and no `feedbackDefaults` mapping. Four things are
 * being checked, and each one is a file a consumer used to have to write:
 *
 * 1. `useTranslation()` is imported straight from the package with **no
 *    generic arguments**, and its keys are still checked — `src/najm-i18n.d.ts`
 *    registers them once for the whole program. Uncomment the marked line to
 *    watch `tsc` reject a typo.
 * 2. `common.untranslated` exists only in `en.ts`. In French it renders the
 *    English string because the root layout passes
 *    `fallbackToDefaultLanguage`, while a key in *neither* catalog still
 *    echoes — the gap stays visible, the screen stays readable.
 * 3. Every feedback state below reads `common.feedback.<field>` through the
 *    kit's default prefix. The layout passes no `feedbackDefaults` at all.
 * 4. Switching the language re-renders all of it and persists through
 *    `/api/ui-language`, and `<html lang>`/`dir` follow.
 */

export default function I18nPage() {
  const { t, language, languages, changeLanguage } = useTranslation();

  // Checked against the registered catalog with no call-site generics.
  const success = t('common.success');
  const fallback = t('common.untranslated', { count: 3 });

  // A key in no catalog. Still echoes, in every language, by design.
  const missing = t('common.untranslated.nowhere' as 'common.success');

  // Uncomment: `tsc` rejects it, because the registry narrowed the key union.
  // t('common.successs');

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Direct i18n</h1>
        <p className="text-muted-foreground text-sm">
          One import from <code>najm-i18n/react</code>, one ambient
          registration in <code>src/najm-i18n.d.ts</code>, and one{' '}
          <code>defineI18n</code> call in <code>src/locales/index.ts</code>.
          No application i18n wrapper of any kind.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Active language: <strong data-testid="active-language">{language}</strong>
        </span>
        {languages.map((candidate) => (
          <NButton
            key={candidate}
            variant={candidate === language ? 'default' : 'outline'}
            onClick={() => void changeLanguage(candidate)}
          >
            {candidate}
          </NButton>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Fallback behavior</h2>
        <dl className="grid grid-cols-[14rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Translated in both</dt>
          <dd data-testid="translated">{success}</dd>

          <dt className="text-muted-foreground">Only in the base catalog</dt>
          <dd data-testid="fallback">{fallback}</dd>

          <dt className="text-muted-foreground">In neither catalog</dt>
          <dd data-testid="missing">{missing}</dd>
        </dl>
        <p className="text-muted-foreground text-xs">
          Switch to <code>fr</code>: the first line changes, the second keeps
          its English text, the third stays a key.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">
          Feedback states, from <code>common.feedback.*</code>
        </h2>
        <div className="grid gap-4 md:grid-cols-2" data-testid="feedback-states">
          <NLoadingState surface="panel" />
          <NEmptyState surface="panel" />
          <NErrorState surface="panel" onRetry={() => undefined} />
          <NForbiddenState surface="panel" />
          <NNotFoundState surface="panel" />
        </div>
      </section>
    </main>
  );
}
