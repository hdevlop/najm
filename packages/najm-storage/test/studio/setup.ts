import '../../../../scripts/bun-test-legacy-decorators';
import { Window } from 'happy-dom';
import { afterEach } from 'bun:test';

const window = new Window();

Object.assign(globalThis, {
  window,
  document: window.document,
  DocumentFragment: window.DocumentFragment,
  HTMLElement: window.HTMLElement,
  Element: window.Element,
  Node: window.Node,
  navigator: window.navigator,
  MutationObserver: window.MutationObserver,
});

const { cleanup } = await import('@testing-library/react');

// Unmount React roots before clearing browser state so effects, providers, and
// per-render stores cannot leak into the next test.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
