import { cleanup } from "@testing-library/react";
import { afterEach } from "bun:test";
import { GlobalWindow } from "happy-dom";

const window = new GlobalWindow({ url: "http://localhost" });

const globals: Record<string, unknown> = {
  window,
  document: window.document,
  navigator: window.navigator,
  Element: window.Element,
  Node: window.Node,
  HTMLElement: window.HTMLElement,
  HTMLButtonElement: window.HTMLButtonElement,
  MutationObserver: window.MutationObserver,
  Event: window.Event,
  MouseEvent: window.MouseEvent,
  localStorage: window.localStorage,
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
  matchMedia: () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
};

for (const [key, value] of Object.entries(globals)) {
  Object.assign(globalThis, { [key]: value });
}

afterEach(() => cleanup());
