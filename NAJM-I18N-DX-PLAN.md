# Najm i18n Direct-Use and Fallback Plan

**Status:** WORK UNITS 0-3 AND 5-6 IMPLEMENTED IN NAJM. Work unit 4 measured
and deferred (see below). Work unit 7 release is in progress; work units 8-10
follow against the exact published packages.

**Last updated:** 2026-09-04

## Objective

Make the normal React experience in every Najm application:

```tsx
import { useTranslation } from "najm-i18n/react";

const { t, language, changeLanguage } = useTranslation();
t("operator.orders.title");
```

The call must provide application-specific key and language autocomplete without
an application wrapper hook. Missing keys may fall back to the configured
default language when the application explicitly enables that policy. Shared
translation mechanics belong to Najm; application catalogs, wording, and
preference side effects remain application-owned.

## Repositories and ownership

- `C:\Users\hdevlop\Desktop\najm` owns translator behavior, public types,
  React bindings, Najm Kit feedback-key conventions, package tests, playground
  proof, packaging, and release notes.
- `C:\Users\hdevlop\Desktop\kafil` is the first consumer. It owns Kafil copy,
  locale selection, cookie policy, formatting locales, and product-specific
  behavior.
- `C:\Users\hdevlop\Desktop\school` adopts independently after Kafil passes.
  It keeps its authenticated profile update, React Query invalidation, and toast
  behavior even when its generic translation wrapper is removed.

## Current evidence

1. `najm-i18n@2.0.3` already exports `getNestedTranslation`, `translate`,
   `createTranslator`, `I18nProvider`, and
   `useTranslation<Key, Language>()`.
2. `translate()` currently falls back to the default-language dictionary only
   when the selected language dictionary is absent. If the selected dictionary
   exists but a key is absent, it returns the key.
3. Kafil works around missing-key fallback by recursively merging English into
   `fr`, `ar`, and `es` in `packages/server/src/locales/index.ts`.
4. School implements per-key English fallback and interpolation again in
   `apps/dashboard/src/hooks/useLanguage.tsx`.
5. Kafil's `useKafilLanguage` exists primarily to bind `TranslationKey` and
   `KafilLanguage` once for roughly 125 consumers. Removing it before package
   type registration would force every consumer to repeat generics.
6. Kafil duplicates supported languages in its server config, web preferences,
   and `/api/ui-language` handler.
7. Najm Kit already documents `common.feedback` as the default feedback prefix,
   but `resolveFeedbackLabels()` does not currently translate
   `<prefix>.<field>`. Kafil therefore still needs an explicit nine-field
   `feedbackDefaults` mapping.
8. The standalone translator already owns the same nested lookup Kafil copied.
   Consumer code should use the public translator rather than another traversal.

## Correctness decisions

### Preserve existing language-level fallback

The new option must not replace the current behavior. Even when missing-key
fallback is disabled, an entirely absent selected-language dictionary must
still use `defaultLanguage`, as `2.0.3` does today.

Use this behavior matrix:

| Selected language | Selected key | Option | Result |
| --- | --- | --- | --- |
| exists | exists | either | selected-language value |
| absent | default key exists | either | default-language value |
| exists | absent | `false`/omitted | key echo |
| exists | absent | `true` | default-language value |
| exists | absent in both | `true` | key echo |

The implementation shape should preserve the selected dictionary fallback
before considering per-key fallback:

```ts
const defaultDictionary = translations[defaultLanguage];
const selectedDictionary = translations[language] ?? defaultDictionary;

const template =
  getNestedTranslation(selectedDictionary, key) ??
  (fallbackToDefaultLanguage && selectedDictionary !== defaultDictionary
    ? getNestedTranslation(defaultDictionary, key)
    : undefined) ??
  key;
```

### Missing-key fallback is opt-in

Add `fallbackToDefaultLanguage?: boolean`, defaulting to `false`, to preserve
the current key-echo contract for existing consumers and Najm Kit diagnostics.
The option must be applied consistently by:

- `translate()` and `createTranslator()`;
- `I18nOptions` and `I18nService` for decorators and injected/server `t`;
- `I18nProvider` for React;
- `NajmAppProvider` when it mounts `I18nProvider`.

Do not ship a React-only fix: Kafil uses the same catalog on server and client,
and removing its merge requires both paths to agree.

### One type registration per TypeScript program

React cannot infer a consumer hook's generic arguments from a provider mounted
elsewhere. Provide declaration merging on the exact public module that declares
the hook:

```ts
// najm-i18n/react
export interface NajmI18nRegistry {}

type RegisteredKey = NajmI18nRegistry extends {
  key: infer Key extends string;
}
  ? Key
  : string;

type RegisteredLanguage = NajmI18nRegistry extends {
  language: infer Language extends string;
}
  ? Language
  : string;
```

`useTranslation` then uses these as its default generic arguments while
retaining explicit generic overrides:

```ts
useTranslation<
  Key extends string = RegisteredKey,
  Language extends string = RegisteredLanguage,
>();
```

An application registers once:

```ts
// najm-i18n.d.ts
declare module "najm-i18n/react" {
  interface NajmI18nRegistry {
    key: import("@kafil/server/locales").UiTranslationKey;
    language: import("@/preferences").KafilLanguage;
  }
}
```

Document that one TypeScript program can have one global registration. A
program with multiple independent catalogs can continue using explicit
generics or a future bound-instance API. Do not hide this limitation.

### Export reusable catalog types

Move Kafil's generic leaf-path utility into `najm-i18n` as a public type:

```ts
export type TranslationKeys<Catalog> = /* string leaf paths */;
```

Keep the first release limited to key and language typing. Typed interpolation
parameters, ICU plurals, rich text, extraction, and lazy namespace loading are
separate features and must not delay the direct-hook fix.

### Provide one pure `defineI18n` configuration

Add a server-safe, framework-neutral definition helper so applications do not
rebuild language arrays, normalization, and bound translators:

```ts
export const kafilI18n = defineI18n({
  translations,
  defaultLanguage: "en",
  fallbackToDefaultLanguage: true,
  languageMetadata: {
    en: { locale: "en-MA", direction: "ltr" },
    fr: { locale: "fr-MA", direction: "ltr" },
    ar: { locale: "ar-MA", direction: "rtl" },
    es: { locale: "es-MA", direction: "ltr" },
  },
});

export const kafilUiI18n = kafilI18n.scope("ui");
```

The returned definition should expose typed, immutable data/helpers without
importing React or Next.js:

- `translations`, `defaultLanguage`, and `supportedLanguages`;
- `isLanguage(value)` and `normalizeLanguage(value)`;
- `translate(language, key, params)` and `createTranslator(language)` with the
  definition's fallback policy already bound;
- `locale(language)` and `direction(language)` when metadata is supplied;
- `scope(prefix)` that projects every language to the same nested catalog by
  reference, not by cloning it.

The server plugin may accept `kafilI18n.options`; React/Kit receives the scoped
UI translations and the same fallback policy. Do not return React hooks from
the server-safe object, create another global singleton, mutate input catalogs,
or deep-clone them. Validate that `defaultLanguage` exists and that a requested
scope is present in the default catalog. This helper is what lets consumer
tests and non-React code delete `getUiTranslation` without repeating the full
catalog and options on every call.

### Optional namespace ergonomics

After the no-argument typed hook is stable, add a backward-compatible prefix
overload:

```tsx
const { t } = useTranslation("operator.orders");
t("title");
```

The runtime implementation prefixes keys exactly once; the type narrows keys
to descendants of the selected namespace. The existing no-argument hook and
explicit full keys remain supported. Treat this as a separate work unit so it
can be deferred if type performance or declaration output becomes fragile.

### Application catalog remains application-owned

Najm must not absorb Kafil or School wording. Apps retain JSON/TypeScript locale
files and choose whether incomplete locales fall back to the default language.
Najm owns lookup, interpolation, fallback mechanics, key types, and provider
state.

### Preference persistence remains layered

- `najm-i18n` stays framework-neutral and must not import Next.js.
- `NajmAppProvider` may continue posting `{ language }` to a configured endpoint.
- A reusable Next route factory belongs in `najm-next/i18n`, not
  `najm-i18n`. It is a follow-up, not a blocker for the direct-hook release.
- School's database/profile mutation, query invalidation, and success toast are
  product behavior. If its translation facade is removed, retain these in a
  focused `useChangeLanguage` or preference-command hook.

## Target application shape

Kafil should retain:

- its four locale catalogs and product wording;
- one ambient `najm-i18n.d.ts` registration;
- application preference/cookie and `en-MA`/`fr-MA`/`ar-MA`/`es-MA` mapping;
- explicit overrides only where Kafil intentionally differs from package
  conventions.

Kafil should remove after adoption:

- `apps/web/src/i18n/useKafilLanguage.ts`;
- the duplicated nested lookup in `apps/web/src/i18n/translations.ts`;
- `apps/web/src/i18n/feedbackDefaults.ts` after the Najm Kit prefix contract and
  Kafil catalog keys are aligned;
- repeated hard-coded supported-language arrays that can be derived from the
  catalog or one application constant.

School should remove generic translation lookup/interpolation/fallback logic,
but not its application-specific language preference command.

## Work units

### 0. Baseline and isolation

- [x] Record the current SHAs and dirty files in Najm, Kafil, and School.
- [x] Do not modify or stage unrelated Najm Core/rate-limit work already present
      in the Najm worktree.
- [x] Record current versions of `najm-i18n`, `najm-kit`, and consumer pins.
- [x] Run the focused existing `najm-i18n` and `najm-kit` tests before edits.
- [x] Measure Kafil and School TypeScript diagnostics before global key
      registration so any editor/typecheck regression is visible.

### 1. Correct missing-key fallback in `najm-i18n`

- [x] Add the opt-in option to `TranslatorOptions` and `I18nOptions`.
- [x] Implement the behavior matrix without changing missing-language fallback.
- [x] Forward the option through `I18nService` and all server translation entry
      points.
- [x] Forward the option through `I18nProvider` and its memo dependencies.
- [x] Forward the option through `NajmAppProvider` without creating a second
      translation source.
- [x] Add standalone translator tests for all five matrix cases, interpolation
      after fallback, and absent default dictionaries.
- [x] Add server plugin/decorator tests proving the option applies to injected
      `t` and that omitted/false still echoes a missing key.
- [x] Add React tests proving language changes and per-key fallback work together.
- [x] Update `najm-i18n` README and public declarations.

### 2. Add direct typed React registration

- [x] Declare and export `NajmI18nRegistry` from the actual
      `najm-i18n/react` source entry.
- [x] Derive default key/language types from the registry with `string`
      fallbacks when no app augments it.
- [x] Keep `useTranslation<ExplicitKey, ExplicitLanguage>()` working unchanged.
- [x] Export `TranslationKeys<Catalog>` from the server-safe root entry.
- [x] Add compile-only fixtures using `@ts-expect-error` to prove valid keys,
      invalid keys, valid languages, invalid languages, unregistered fallback,
      and explicit-generic compatibility.
- [x] Build the package and inspect `dist/react.d.ts`; verify the public
      interface is augmentable through `declare module "najm-i18n/react"` and
      was not hidden in an unaugmentable generated chunk.
- [x] Measure declaration size and typecheck diagnostics with a catalog at least
      as large as Kafil's UI catalog.
- [x] Document the one-registry-per-TypeScript-program rule.

### 3. Add the pure typed `defineI18n` helper

- [x] Define the generic input/output types and infer the language union from
      the translation object keys.
- [x] Bind supported-language enumeration, validation, normalization, fallback
      policy, translation, and translator creation.
- [x] Support optional typed locale/direction metadata without assuming Arabic
      is the only RTL language.
- [x] Implement `scope(prefix)` as a typed projection that reuses nested object
      references and reports an invalid default-language scope clearly.
- [x] Expose plugin/provider option data without importing `najm-core`, React,
      Next.js, or Najm Kit into the helper module.
- [x] Test inference, invalid default languages, invalid metadata keys, scoped
      keys, missing non-default scopes, reference reuse, and bound fallback.
- [x] Document separate full server and scoped UI use from one definition.

### 4. Add namespace/prefix typing if the core registration is stable

**DEFERRED — implemented, measured, reverted.** The overload worked
(`useTranslation('operator.budgets')` narrowed `t` to the 63 relative keys under
that branch, prefix stripped, interpolation and language changes intact), but it
failed this unit's own regression gate.

`Namespaces<RegisteredKey>` sits in a parameter position, so TypeScript computes
it during overload resolution at *every* `useTranslation()` call site, not only
scoped ones. Measured on `apps/playground` — a 147-key catalog, an order of
magnitude smaller than Kafil's:

| `tsc --noEmit -p apps/playground` | Types | Instantiations | Check time |
| --- | --- | --- | --- |
| without the overload | 12,566 | 55,268 | 0.68s |
| with the overload | 251,529 | 953,019 | 5.66s |
| after revert | 12,566 | 55,268 | 0.67s |

20x the types, 17x the instantiations, 8.3x the check time. Kafil's catalog is
1,691 keys, so its cost would be worse. That is a material editor regression by
any reading, and this unit's last box says to defer on exactly that finding.

A future attempt should keep the conditional types out of parameter position —
a separate bound-scope API (`i18n.scope('operator.orders')` returning its own
typed hook) costs nothing at unscoped call sites, where the previous shape
charged every one of them.

- [x] Define public namespace and relative-key utility types.
- [x] Add `useTranslation(prefix)` without changing `useTranslation()`.
- [x] Test nested namespaces, invalid namespaces, leaf selection, interpolation,
      and explicit generic use.
- [x] Re-run large-catalog type diagnostics; defer this work unit if it causes a
      material editor/typecheck regression. **Deferred on this measurement.**

### 5. Finish Najm Kit's feedback-prefix contract

- [x] Fix `resolveFeedbackLabels()` so the default `common.feedback` prefix is
      actually read as `<prefix>.<field>` when no explicit `labelKeys[field]`
      exists.
- [x] Preserve resolution order: literal override, explicit key or prefix key,
      packaged English fallback, then `undefined` for fields with no packaged
      fallback.
- [x] Treat a translator result equal to the requested key as missing before
      falling through to packaged English/`undefined`; otherwise the prefix
      would render as visible key text.
- [x] Add a `FeedbackKey<Prefix>` type matching the existing pagination and
      toolbar conventions if it improves call-site checking without narrowing
      structural translators incorrectly.
- [x] Add tests for default prefix, custom prefix, explicit per-field key,
      literal override, language change, key echo, and `errorMessage` absence.
- [x] Update comments and README so documented and implemented behavior agree.
- [x] Do not add a Najm dependency to the framework-neutral Kit root merely to
      ship translated product copy.

### 6. Prove the full contract in `apps/playground`

- [x] Add a base-language-only key and omit it from the second locale.
- [x] Enable missing-key fallback through `NajmAppProvider` and show that the
      second locale renders the base value, while an unknown key still echoes.
- [x] Register playground types once and use direct unparameterized
      `useTranslation()` with a compile-time invalid-key fixture.
- [x] Define the playground catalog once with `defineI18n` and use a scoped
      definition for the React catalog without cloning locale objects.
- [x] Exercise the default `common.feedback` convention without a
      `feedbackDefaults` mapping.
- [x] Verify language change still updates `<html lang>`/direction and persists
      through `/api/ui-language`.
- [x] Run playground build and existing UI-provider acceptance relevant to this
      behavior.

### 7. Najm package gates and release boundary

- [x] Run focused `najm-i18n` tests.
- [x] Run `bun run --cwd packages/najm-i18n build` and inspect both root and
      React exports from `dist`.
- [x] Run `bun run test:ui`, `bun run lint:ui`, and the relevant Najm Kit build
      and Next 16 integration gate.
- [x] Run the sequential root suite `bun run test` only after focused gates pass.
- [x] Check `git diff --check` and audit the diff for unrelated dirty work.
- [x] Prepare a minor `najm-i18n` version and a patch `najm-kit` version only
      after implementation review. Version preparation is not publication.
- [ ] Commit package changes before packing.
- [ ] Run `bun scripts/publish-package.ts najm-i18n --pack-only` and the
      corresponding Kit command; record tarball paths, SHA-256 values, source
      commit, manifests, exports, and included declaration files.
- [ ] Install the exact tarballs into a disposable consumer and verify imports
      from `najm-i18n`, `najm-i18n/react`, and `najm-kit/app`.
- [ ] Stop and request explicit release authorization before any registry
      publication. Do not publish merely because source and tarball gates pass.
- [ ] After authorization, publish in dependency order: `najm-i18n` before
      `najm-kit`.
- [ ] Verify registry metadata, tarball integrity, public declarations, and
      installability independently of the source checkout.

### 8. Kafil-first adoption

- [ ] Pin the exact published `najm-i18n` and `najm-kit` versions in root
      overrides and lockfile; do not test consumer acceptance against workspace
      links.
- [ ] Add one `declare module "najm-i18n/react"` registration to the web
      TypeScript program.
- [ ] Enable `fallbackToDefaultLanguage` for both server and React translation
      paths.
- [ ] Replace repeated supported-language, normalization, formatting-locale,
      direction, and static translation helpers with one `defineI18n`
      definition plus its `ui` scope.
- [ ] Remove `mergeLocale` only after tests prove per-key fallback in both paths.
- [ ] Derive `KafilLanguage` and supported-language validation from one catalog
      or canonical application constant; remove duplicate arrays.
- [ ] Replace Kafil's nested lookup with `translate`, `createTranslator`, or a
      package-provided bound translator.
- [ ] Replace `useKafilLanguage` imports with direct
      `najm-i18n/react` imports. Preserve behavior at the two language switchers:
      unsupported values and persistence failures must remain visible rather
      than becoming unhandled promises.
- [ ] Align locale keys with `common.feedback.<field>`, remove
      `KAFIL_FEEDBACK_DEFAULTS`, and stop passing the mapping to
      `NajmAppProvider`.
- [ ] Preserve Kafil-owned route/cookie policy, formatting locale mapping,
      domain copy, tests, and safe error-display policy.
- [ ] Update focused i18n, feedback-state, status-label, applicants, theme, and
      provider-adoption tests.
- [ ] Confirm there are no remaining imports of deleted wrappers or duplicate
      traversal/interpolation implementations.

### 9. Kafil acceptance

- [ ] Run focused web i18n and adoption tests while iterating.
- [ ] Run Kafil's required root gate:

  ```text
  bun run lint
  bun run typecheck
  bun run test
  bun run build
  bun run db:generate
  ```

- [ ] Require `db:generate` to produce no migration.
- [ ] Verify `en`, `fr`, `ar`, and `es`, including an intentionally missing
      non-English key falling back to English and a truly unknown key following
      the documented diagnostic behavior.
- [ ] Verify Arabic RTL and language persistence across a reload.
- [ ] Report source/test completion separately from browser/visual acceptance.

### 10. School adoption, independently

- [ ] Re-audit School against the published artifacts and its current dirty
      work; do not copy Kafil's migration blindly.
- [ ] Add School's one-time React registry and enable per-key English fallback.
- [ ] Move consumers to direct `najm-i18n/react` imports where they need only
      translation state.
- [ ] Replace the current generic fallback and interpolation implementation with
      package behavior.
- [ ] Extract and retain authenticated preference persistence, query cache
      updates, response messaging, and toasts in an app-owned command hook.
- [ ] Keep School-specific catalogs, roles, routes, locale checks, and branding.
- [ ] Do not delete `scripts/check_i18n_keys.py` until Najm offers equivalent
      missing-key, non-string, report, and template-generation capabilities and
      School has adopted them explicitly.
- [ ] Run School's package, full application, i18n, build, and browser gates
      required by its active upgrade plan.

### 11. Optional reusable Next persistence adapter

- [ ] Only after both consumers are stable, evaluate
      `najm-next/i18n` with a `createLanguageRoute` helper.
- [ ] Accept application-owned supported languages, cookie name/options, error
      shape, and normalization; do not hard-code Kafil or playground policy.
- [ ] Keep initial server language resolution explicit enough for an app to set
      `<html lang>` and `dir` without hiding request/cookie behavior.
- [ ] Treat this as a separate `najm-next` release and consumer migration.

## Acceptance criteria

The plan is complete only when all of the following are true:

- Direct `useTranslation()` imports are typed in Kafil without repeated generic
  arguments or an application translation wrapper.
- Missing-language behavior is unchanged from `najm-i18n@2.0.3`.
- Opt-in missing-key fallback behaves identically in standalone, server/plugin,
  and React paths.
- `TranslationKeys<T>` and registry augmentation are present and usable in the
  packed/published declaration files, not only source.
- One server-safe `defineI18n` definition supplies typed languages,
  normalization, metadata, scoped UI resources, and bound translators without
  cloning catalogs.
- Kafil no longer deep-merges catalogs or duplicates nested lookup logic.
- Najm Kit's documented feedback prefix works, allowing Kafil's mapping file to
  be removed without losing localized feedback labels.
- School no longer owns generic lookup/interpolation/fallback mechanics, while
  its profile preference behavior remains intact.
- Playground, Kafil, and School pass their independent gates against exact
  published package versions.
- Package publication, consumer Git publication, and deployment are reported as
  separate outcomes; none is inferred from another.

## Deferred features

These may improve i18n later but are deliberately outside this release:

- ICU plural/select syntax and rich React messages;
- compile-time interpolation-parameter inference;
- translation extraction or automatic source rewriting;
- lazy namespace loading and locale chunking;
- translation-management-service integration;
- replacing Kafil or School catalogs with package-owned wording;
- deleting consumer locale-check tooling without feature parity.
