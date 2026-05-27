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

// Clean up document body between tests to prevent DOM leaking
afterEach(() => {
  document.body.innerHTML = '';
});
