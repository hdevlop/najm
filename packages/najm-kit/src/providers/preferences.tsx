import * as React from "react";

import type { NajmMode } from "../theme/types";

/**
 * Theme and time zone, the two preferences that outlive a render.
 *
 * Both are *uncontrolled*: the `initial*` props seed state the provider owns
 * from then on, and later changes to those props are ignored. That is the
 * shape the server hand-off wants — the page is rendered once against a cookie,
 * and every change after that originates here.
 *
 * Persistence is not this provider's business. It applies the change to the
 * document, then hands the new value to a callback the application supplies.
 * See `NajmNextUIProvider` in `najm-kit/next` for the cookie-endpoint wiring.
 */
export interface NajmPreferencesContextValue {
  theme: NajmMode;
  setTheme: (theme: NajmMode) => Promise<void>;
  timeZone: string;
  setTimeZone: (timeZone: string) => Promise<void>;
}

const NajmPreferencesContext =
  React.createContext<NajmPreferencesContextValue | null>(null);

export const DEFAULT_TIME_ZONE = "UTC";

export interface NajmPreferencesProviderProps {
  children: React.ReactNode;
  /** Seeds theme state; ignored after mount. Defaults to `"light"`. */
  initialTheme?: NajmMode;
  /** Seeds time zone state; ignored after mount. Defaults to `"UTC"`. */
  initialTimeZone?: string;
  /** Persist the new theme. Rejections propagate to the `setTheme` caller. */
  onThemeChange?: (theme: NajmMode) => void | Promise<void>;
  /** Persist the new time zone. Rejections propagate to `setTimeZone`. */
  onTimeZoneChange?: (timeZone: string) => void | Promise<void>;
  /** Sanitize a time zone before it is stored. Defaults to identity. */
  normalizeTimeZone?: (value: string) => string;
}

function applyTheme(theme: NajmMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyTimeZone(timeZone: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.timeZone = timeZone;
}

/**
 * Standalone preferences, without the design and table layers.
 *
 * `NajmUIProvider` renders this internally, so most applications never name it.
 * It is exported for the case where something *above* the design layer needs to
 * read the theme — a runtime theme editor, typically, which owns the design
 * config and therefore has to sit above the provider consuming it. Hoisting
 * preferences out is then a reorder rather than a fork.
 */
export function NajmPreferencesProvider({
  children,
  initialTheme = "light",
  initialTimeZone = DEFAULT_TIME_ZONE,
  onThemeChange,
  onTimeZoneChange,
  normalizeTimeZone,
}: NajmPreferencesProviderProps) {
  const [theme, setThemeState] = React.useState<NajmMode>(initialTheme);
  const [timeZone, setTimeZoneState] = React.useState<string>(() =>
    normalizeTimeZone ? normalizeTimeZone(initialTimeZone) : initialTimeZone,
  );

  // The callbacks are read through a ref so an inline arrow in the consumer
  // does not change the identity of `setTheme`, which is handed to buttons.
  const onThemeChangeRef = React.useRef(onThemeChange);
  const onTimeZoneChangeRef = React.useRef(onTimeZoneChange);
  const normalizeRef = React.useRef(normalizeTimeZone);
  React.useEffect(() => {
    onThemeChangeRef.current = onThemeChange;
    onTimeZoneChangeRef.current = onTimeZoneChange;
    normalizeRef.current = normalizeTimeZone;
  });

  // Seeded state is applied to the document on mount so a provider rendered
  // under a server-painted `class="dark"` cannot disagree with it, and so the
  // `data-time-zone` attribute exists before the first consumer reads it.
  React.useEffect(() => {
    applyTheme(theme);
    applyTimeZone(timeZone);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only; changes go through the setters
  }, []);

  const setTheme = React.useCallback(async (next: NajmMode) => {
    // Paint first, await persistence second. The class toggle is what the user
    // is waiting to see; a slow or failing cookie write should not hold it.
    setThemeState(next);
    applyTheme(next);
    await onThemeChangeRef.current?.(next);
  }, []);

  const setTimeZone = React.useCallback(async (next: string) => {
    const normalized = normalizeRef.current ? normalizeRef.current(next) : next;
    setTimeZoneState(normalized);
    applyTimeZone(normalized);
    await onTimeZoneChangeRef.current?.(normalized);
  }, []);

  const value = React.useMemo<NajmPreferencesContextValue>(
    () => ({ theme, setTheme, timeZone, setTimeZone }),
    [theme, setTheme, timeZone, setTimeZone],
  );

  return (
    <NajmPreferencesContext.Provider value={value}>
      {children}
    </NajmPreferencesContext.Provider>
  );
}

/**
 * Returns the context when one is mounted, or `null`.
 *
 * `NajmUIProvider` uses this to defer to an outer `NajmPreferencesProvider`
 * instead of shadowing it, so nesting the two is well-defined rather than
 * quietly producing two disagreeing themes.
 */
export function useNajmPreferencesContext(): NajmPreferencesContextValue | null {
  return React.useContext(NajmPreferencesContext);
}

function usePreferencesOrThrow(hook: string): NajmPreferencesContextValue {
  const value = React.useContext(NajmPreferencesContext);
  if (!value) {
    throw new Error(
      `${hook} must be rendered under a NajmUIProvider or NajmPreferencesProvider.`,
    );
  }
  return value;
}

/** The live theme and a setter that persists through `onThemeChange`. */
export function useNajmTheme(): Pick<
  NajmPreferencesContextValue,
  "theme" | "setTheme"
> {
  const { theme, setTheme } = usePreferencesOrThrow("useNajmTheme");
  return React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
}

/** The live time zone and a setter that persists through `onTimeZoneChange`. */
export function useNajmTimeZone(): Pick<
  NajmPreferencesContextValue,
  "timeZone" | "setTimeZone"
> {
  const { timeZone, setTimeZone } = usePreferencesOrThrow("useNajmTimeZone");
  return React.useMemo(
    () => ({ timeZone, setTimeZone }),
    [timeZone, setTimeZone],
  );
}
