import { GlobalWindow } from "happy-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "bun:test";

const win = new GlobalWindow({ url: "http://localhost" });

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
    const shouldFail =
      typeof failingImageSrc === "string"
        ? failingImageSrc === value
        : failingImageSrc instanceof RegExp
        ? failingImageSrc.test(value)
        : false;
    if (shouldFail) {
      failingImageSrc = null;
      this.complete = false;
      this.naturalWidth = 0;
      this.onerror?.();
      for (const cb of this.#listeners.error ?? []) cb();
      return;
    }
    this.complete = true;
    this.naturalWidth = 1;
    this.onload?.();
    for (const cb of this.#listeners.load ?? []) cb();
  }
  get src() {
    return this.#src;
  }
}

let failingImageSrc: string | RegExp | null = null;
(globalThis as any).__najmFailNextImage = (match: string | RegExp) => {
  failingImageSrc = match;
};
(globalThis as any).__najmResetImageMock = () => {
  failingImageSrc = null;
};
(win as any).Image = MockImage;

class MockFileReader {
  onloadend: ((this: MockFileReader, ev: ProgressEvent) => void) | null = null;
  onerror: ((this: MockFileReader, ev: ProgressEvent) => void) | null = null;
  result: string | ArrayBuffer | null = null;
  error: Error | null = null;
  readyState = 0;
  readAsDataURL(blob: Blob) {
    this.result = `data:${(blob as any).type || ""};base64,test`;
    this.readyState = 2;
    this.onloadend?.call(this, {} as ProgressEvent);
  }
  readAsText() {
    this.result = "";
    this.readyState = 2;
    this.onloadend?.call(this, {} as ProgressEvent);
  }
  abort() {
    this.readyState = 2;
    this.error = new Error("aborted");
  }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

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
  Blob: win.Blob,
  File: win.File,
  FileReader: MockFileReader,
  FormData: win.FormData,
  URL: win.URL,
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
  (globalThis as any)[key] = value;
}

afterEach(() => {
  cleanup();
});
