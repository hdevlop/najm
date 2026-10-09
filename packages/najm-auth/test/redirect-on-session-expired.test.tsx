import { afterEach, describe, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';

const testWindow = new Window({ url: 'http://localhost/students/42?tab=fees' });
Object.assign(globalThis, {
  window: testWindow,
  document: testWindow.document,
  DocumentFragment: testWindow.DocumentFragment,
  HTMLElement: testWindow.HTMLElement,
  Element: testWindow.Element,
  Node: testWindow.Node,
  navigator: testWindow.navigator,
  MutationObserver: testWindow.MutationObserver,
});

const React = await import('react');
const { act, cleanup, render } = await import('@testing-library/react');
const { AuthClientContext } = await import('../src/client/react/context');
const { useRedirectOnSessionExpired } = await import('../src/client/react/useRedirectOnSessionExpired');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function fakeClient() {
  const listeners = new Map<string, Set<(data: unknown) => void>>();
  return {
    on: (event: string, listener: (data: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    off: (event: string, listener: (data: unknown) => void) => listeners.get(event)?.delete(listener),
    emit: (event: string) => listeners.get(event)?.forEach((listener) => listener(null)),
  };
}

function Probe({ route }: { route?: string }) {
  useRedirectOnSessionExpired(route);
  return null;
}

describe('useRedirectOnSessionExpired', () => {
  test('an expired session goes to sign in and remembers the page', () => {
    const client = fakeClient();
    const assign = mock(() => {});
    (window.location as any).assign = assign;
    render(<AuthClientContext.Provider value={client as any}><Probe route="/sign-in" /></AuthClientContext.Provider>);

    act(() => client.emit('sessionExpired'));

    expect(assign).toHaveBeenCalledTimes(1);
    const target = new URL(String((assign.mock.calls[0] as unknown[])[0]));
    expect(target.pathname).toBe('/sign-in');
    expect(target.searchParams.get('from')).toBe('/students/42?tab=fees');
  });

  test('a normal sign-out does not redirect', () => {
    const client = fakeClient();
    const assign = mock(() => {});
    (window.location as any).assign = assign;
    render(<AuthClientContext.Provider value={client as any}><Probe /></AuthClientContext.Provider>);

    act(() => client.emit('logout'));

    expect(assign).not.toHaveBeenCalled();
  });
});
