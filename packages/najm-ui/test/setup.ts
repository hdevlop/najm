import { Window } from "happy-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "bun:test";

const win = new Window({ url: "http://localhost" });

const globals: Record<string, any> = {
  window: win,
  document: win.document,
  navigator: win.navigator,
  Node: win.Node,
  HTMLElement: win.HTMLElement,
  HTMLDivElement: win.HTMLDivElement,
  HTMLButtonElement: win.HTMLButtonElement,
  HTMLInputElement: win.HTMLInputElement,
  HTMLSelectElement: win.HTMLSelectElement,
  HTMLTextAreaElement: win.HTMLTextAreaElement,
  HTMLAnchorElement: win.HTMLAnchorElement,
  HTMLSpanElement: win.HTMLSpanElement,
  DocumentFragment: win.DocumentFragment,
  MutationObserver: win.MutationObserver,
  customElements: win.customElements,
  ShadowRoot: win.ShadowRoot,
  Event: win.Event,
  CustomEvent: win.CustomEvent,
  KeyboardEvent: win.KeyboardEvent,
  MouseEvent: win.MouseEvent,
  FocusEvent: win.FocusEvent,
  InputEvent: win.InputEvent,
  PointerEvent: win.PointerEvent,
  ResizeObserver: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
  matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
};

for (const [key, value] of Object.entries(globals)) {
  if (!(key in globalThis)) {
    (globalThis as any)[key] = value;
  }
}

afterEach(() => {
  cleanup();
});
