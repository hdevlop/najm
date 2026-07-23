import { afterEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

const testWindow = new Window({ url: 'http://localhost/auth/oauth/callback?returnTo=/dashboard' });
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
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const { AuthClientContext } = await import('../src/client/react/context');
const { GoogleLoginButton } = await import('../src/client/react/GoogleLoginButton');
const { OAuthCallback } = await import('../src/client/react/OAuthCallback');
const { useGoogleLogin } = await import('../src/client/react/useGoogleLogin');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const user = { id: 'user-1', email: 'user@example.com' };

const withClient = (client: Record<string, unknown>, child: React.ReactNode) => (
  <AuthClientContext.Provider value={client as any}>{child}</AuthClientContext.Provider>
);

describe('Google OAuth React bindings', () => {
  test('GoogleLoginButton preserves the child click handler and starts a Google redirect', () => {
    const calls: string[] = [];
    const client = {
      loginWithGoogle: (options: unknown) => calls.push(`google:${JSON.stringify(options)}`),
    };

    render(withClient(client, (
      <GoogleLoginButton returnTo="/dashboard">
        <button type="button" onClick={() => calls.push('child')}>Google</button>
      </GoogleLoginButton>
    )));

    fireEvent.click(screen.getByRole('button', { name: 'Google' }));
    expect(calls).toEqual(['child', 'google:{"returnTo":"/dashboard"}']);
  });

  test('GoogleLoginButton preserves an explicitly disabled child', () => {
    const client = { loginWithGoogle: () => { throw new Error('should not run'); } };
    render(withClient(client, (
      <GoogleLoginButton>
        <button type="button" disabled>Google</button>
      </GoogleLoginButton>
    )));
    expect((screen.getByRole('button', { name: 'Google' }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('useGoogleLogin exposes linking failures through state and onError', async () => {
    const errors: string[] = [];
    const client = { linkOAuthAccount: async () => { throw new Error('link failed'); } };

    function Probe() {
      const { linkGoogle, error, isRedirecting } = useGoogleLogin({
        onError: (value) => errors.push(value.message),
      });
      return (
        <>
          <button type="button" onClick={() => { void linkGoogle(); }}>Link</button>
          <output>{error?.message ?? (isRedirecting ? 'loading' : 'idle')}</output>
        </>
      );
    }

    render(withClient(client, <Probe />));
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(screen.getByText('link failed')).toBeTruthy());
    expect(errors).toEqual(['link failed']);
  });

  test('OAuthCallback completes once in Strict Mode and renders the fallback while completing', async () => {
    let completions = 0;
    let resolve!: (value: typeof user) => void;
    const pending = new Promise<typeof user>((done) => { resolve = done; });
    const client = { completeOAuthLogin: () => { completions += 1; return pending; } };

    render(withClient(client, (
      <React.StrictMode>
        <OAuthCallback fallback={<p>Completing</p>} />
      </React.StrictMode>
    )));
    expect(screen.getByText('Completing')).toBeTruthy();
    await waitFor(() => expect(completions).toBe(1));
    resolve(user);
    await waitFor(() => expect(completions).toBe(1));
  });

  test('OAuthCallback renders the documented error fallback', async () => {
    const client = { completeOAuthLogin: async () => { throw new Error('session unavailable'); } };
    render(withClient(client, (
      <OAuthCallback errorFallback={({ error }) => <p>OAuth error: {error.message}</p>} />
    )));
    await waitFor(() => expect(screen.getByText('OAuth error: session unavailable')).toBeTruthy());
  });
});
