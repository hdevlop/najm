import { GlobalWindow } from "happy-dom";
import { afterEach } from "bun:test";

// ============================================================================
// A DOM for the settings surface.
//
// Modelled on `najm-kit`'s own test setup, because these components render the
// kit's primitives and hit the same gaps: happy-dom fires no <img> load event,
// has no ResizeObserver, and has no object URLs.
// ============================================================================

const win = new GlobalWindow({ url: "http://localhost" });

/** Radix only shows an <img> after a preload fires `load`, which happy-dom never does. */
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  complete = false;
  naturalWidth = 0;
  #src = "";
  #listeners: Record<string, Array<() => void>> = { load: [], error: [] };

  addEventListener(type: string, cb: () => void) {
    (this.#listeners[type] ??= []).push(cb);
  }
  removeEventListener(type: string, cb: () => void) {
    this.#listeners[type] = (this.#listeners[type] ?? []).filter((fn) => fn !== cb);
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

// A rendered <img> in happy-dom reports `complete === true` with
// `naturalWidth === 0` — which in a real browser is precisely the signature of
// an image that finished loading and failed. `NThemeImage` reads exactly that
// pair on mount to catch a server-rendered asset that 404'd before hydration,
// so leaving the default in place would make every image in every test look
// broken.
//
// happy-dom never fetches, so it never finishes: `complete` is false here, and
// the tests that care about failure dispatch a real `error` event instead.
Object.defineProperty(win.HTMLImageElement.prototype, "complete", {
  configurable: true,
  get() {
    return false;
  },
});

// Object URLs, counted. The count is what the leak test reads: every preview
// the branding editor creates must be revoked when its draft goes away.
const liveUrls = new Set<string>();
let urlCounter = 0;

const objectUrlApi = {
  createObjectURL: (): string => {
    urlCounter += 1;
    const url = `blob:najm-theme/${urlCounter}`;
    liveUrls.add(url);
    return url;
  },
  revokeObjectURL: (url: string): void => {
    liveUrls.delete(url);
  },
};

(globalThis as Record<string, unknown>).__najmThemeLiveObjectUrls = () => liveUrls.size;

class MockFileReader {
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | ArrayBuffer | null = null;
  readyState = 0;
  readAsDataURL(blob: Blob) {
    this.result = `data:${blob.type || ""};base64,test`;
    this.readyState = 2;
    this.onloadend?.();
  }
  readAsText() {
    this.result = "";
    this.readyState = 2;
    this.onloadend?.();
  }
  abort() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

Object.assign(win.URL, objectUrlApi);

const globals: Record<string, unknown> = {
  window: win,
  document: win.document,
  navigator: win.navigator,
  Element: win.Element,
  Node: win.Node,
  NodeFilter: win.NodeFilter,
  HTMLElement: win.HTMLElement,
  HTMLImageElement: win.HTMLImageElement,
  HTMLDivElement: win.HTMLDivElement,
  HTMLButtonElement: win.HTMLButtonElement,
  HTMLInputElement: win.HTMLInputElement,
  HTMLSelectElement: win.HTMLSelectElement,
  HTMLTextAreaElement: win.HTMLTextAreaElement,
  HTMLAnchorElement: win.HTMLAnchorElement,
  HTMLSpanElement: win.HTMLSpanElement,
  HTMLLabelElement: win.HTMLLabelElement,
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
  DataTransfer: win.DataTransfer,
  Blob: win.Blob,
  File: win.File,
  FileList: win.FileList,
  FileReader: MockFileReader,
  FormData: win.FormData,
  URL: win.URL,
  Image: MockImage,
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id as unknown as Timer),
  matchMedia: () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
};

for (const [key, value] of Object.entries(globals)) {
  (globalThis as Record<string, unknown>)[key] = value;
}

// Imported *after* the globals above are in place. `@testing-library/dom`
// binds `screen` to `document.body` at module-evaluation time, so a static
// import at the top of this file would capture a world with no document and
// every `screen` query would throw.
const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});
