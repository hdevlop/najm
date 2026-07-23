import { Window } from "happy-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "bun:test";

const win = new Window({ url: "http://localhost" });

// happy-dom never fires <img> load events, so Radix Avatar (which only renders
// the <img> after `new window.Image()` fires `load`) would never show the image.
// Mark the preload image complete when `src` is set so Radix can resolve it as loaded.
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  referrerPolicy = "";
  complete = false;
  naturalWidth = 0;
  #src = "";
  #listeners: Record<string, Array<() => void>> = { load: [], error: [] };
  addEventListener(type: string, cb: () => void) {
    (this.#listeners[type] ??= []).push(cb);
  }
  removeEventListener(type: string, cb: () => void) {
    this.#listeners[type] = (this.#listeners[type] ?? []).filter((f) => f !== cb);
  }
  set src(value: string) {
    this.#src = value;
    if (!value) return;
    this.complete = true;
    this.naturalWidth = 1;
    this.onload?.();
    for (const cb of this.#listeners.load ?? []) cb();
  }
  get src() {
    return this.#src;
  }
}
(win as any).Image = MockImage;

const globals: Record<string, any> = {
  window: win,
  document: win.document,
  navigator: win.navigator,
  Element: win.Element,
  Node: win.Node,
  NodeFilter: win.NodeFilter,
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
