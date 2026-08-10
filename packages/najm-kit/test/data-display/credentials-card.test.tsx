import 'reflect-metadata';
import { afterEach, beforeEach, describe, test, expect, vi } from 'bun:test';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { KeyRound, Phone } from 'lucide-react';
import { NCredentialsCard } from '../../src/components/data-display/NCredentialsCard';
import { NIcon } from '../../src/components/Icon';

type ClipboardStub = {
  writeText: (text: string) => Promise<void>;
};

const ORIGINAL_CLIPBOARD = Object.getOwnPropertyDescriptor(globalThis.navigator ?? {}, 'clipboard');

function installClipboard(stub: ClipboardStub | undefined) {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: stub,
  });
}

afterEach(() => {
  if (ORIGINAL_CLIPBOARD) {
    Object.defineProperty(globalThis.navigator, 'clipboard', ORIGINAL_CLIPBOARD);
  } else {
    try {
      delete (globalThis.navigator as any).clipboard;
    } catch {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        configurable: true,
        writable: true,
        value: undefined,
      });
    }
  }
});

const SAMPLE_FIELDS = [
  { label: 'Phone', value: '+1 555 0100', icon: Phone },
  { label: 'Initial password', value: 'p@ssw0rd!', icon: KeyRound },
];

describe('NCredentialsCard', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  test('renders each field as a dt/dd pair in order', () => {
    const { container } = render(<NCredentialsCard fields={SAMPLE_FIELDS} title="Account created" />);
    const fields = container.querySelectorAll('[data-testid="credentials-card-field"]');
    expect(fields.length).toBe(2);
    const dtLabels = container.querySelectorAll('dt');
    expect(dtLabels.length).toBe(2);
    expect(dtLabels[0].textContent).toBe('Phone');
    expect(dtLabels[1].textContent).toBe('Initial password');
    const ddValues = container.querySelectorAll('dd');
    expect(ddValues[0].textContent).toBe('+1 555 0100');
    expect(ddValues[1].textContent).toBe('p@ssw0rd!');
  });

  test('default copy text is the newline-joined label: value list', async () => {
    const writeText = vi.fn(async () => undefined);
    installClipboard({ writeText });
    const { getByRole } = render(<NCredentialsCard fields={SAMPLE_FIELDS} />);
    const button = getByRole('button', { name: /copy details/i });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('Phone: +1 555 0100\nInitial password: p@ssw0rd!');
  });

  test('copyText override produces custom text', async () => {
    const writeText = vi.fn(async () => undefined);
    installClipboard({ writeText });
    const copyText = vi.fn(() => 'OVERRIDE');
    const { getByRole } = render(
      <NCredentialsCard fields={SAMPLE_FIELDS} copyText={copyText} />,
    );
    const button = getByRole('button', { name: /copy details/i });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });
    expect(copyText).toHaveBeenCalledTimes(1);
    expect((copyText.mock.calls[0] as unknown as [typeof SAMPLE_FIELDS])[0]).toEqual(SAMPLE_FIELDS);
    expect(writeText).toHaveBeenCalledWith('OVERRIDE');
  });

  test('successful copy swaps label, fires onCopy, and announces politely', async () => {
    const writeText = vi.fn(async () => undefined);
    installClipboard({ writeText });
    const onCopy = vi.fn();
    const { getByRole, getByTestId } = render(
      <NCredentialsCard
        fields={SAMPLE_FIELDS}
        copiedLabel="Copié"
        copyLabel="Copier les détails"
        onCopy={onCopy}
      />,
    );

    const live = getByTestId('credentials-card-status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('');

    const button = getByRole('button', { name: /copier les détails/i });
    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(getByRole('button', { name: /copié/i })).toBeTruthy();
    expect(live.textContent).toBe('Copié');
  });

  test('rejected writeText calls onCopyError, shows error label, no unhandled rejection', async () => {
    const failure = new Error('denied');
    const writeText = vi.fn(async () => {
      throw failure;
    });
    installClipboard({ writeText });
    const onCopyError = vi.fn();

    const unhandled: unknown[] = [];
    const handler = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
    };
    globalThis.addEventListener('unhandledrejection', handler);

    try {
      const { getByRole, getByTestId } = render(
        <NCredentialsCard
          fields={SAMPLE_FIELDS}
          copyErrorLabel="Échec"
          onCopyError={onCopyError}
        />,
      );
      fireEvent.click(getByRole('button', { name: /copy details/i }));
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(writeText).toHaveBeenCalledTimes(1);
      expect(onCopyError).toHaveBeenCalledTimes(1);
      expect(onCopyError.mock.calls[0]?.[0]).toBe(failure);
      expect(getByRole('button', { name: /échec/i })).toBeTruthy();
      expect(getByTestId('credentials-card-status').textContent).toBe('Échec');
      expect(unhandled).toHaveLength(0);
    } finally {
      globalThis.removeEventListener('unhandledrejection', handler);
    }
  });

  test('absent navigator.clipboard takes the same failure path', async () => {
    installClipboard(undefined);
    const onCopyError = vi.fn();
    const { getByRole, getByTestId } = render(
      <NCredentialsCard
        fields={SAMPLE_FIELDS}
        copyErrorLabel="Copy failed"
        onCopyError={onCopyError}
      />,
    );
    fireEvent.click(getByRole('button', { name: /copy details/i }));
    expect(onCopyError).toHaveBeenCalledTimes(1);
    expect(getByRole('button', { name: /copy failed/i })).toBeTruthy();
    expect(getByTestId('credentials-card-status').textContent).toBe('Copy failed');
  });

  test('hideCopyAction removes the button while actions still render', () => {
    const { queryByRole, getByText } = render(
      <NCredentialsCard
        fields={SAMPLE_FIELDS}
        hideCopyAction
        actions={<button type="button">Done</button>}
      />,
    );
    expect(queryByRole('button', { name: /copy details/i })).toBeNull();
    expect(getByText('Done')).toBeTruthy();
  });

  test('empty fields renders without throwing', () => {
    const { container } = render(<NCredentialsCard fields={[]} title="Account created" />);
    expect(container.querySelector('[data-testid="credentials-card-list"]')).toBeNull();
    expect(container.querySelector('[data-testid="credentials-card"]')).toBeTruthy();
    expect(container.textContent).toContain('Account created');
  });

  test('actions slot still renders without the copy button when hideCopyAction is set', () => {
    const { container } = render(
      <NCredentialsCard
        fields={SAMPLE_FIELDS}
        hideCopyAction
        actions={<span data-testid="custom-action">custom</span>}
      />,
    );
    expect(container.querySelector('[data-testid="custom-action"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="credentials-card-field"]')).toBeTruthy();
  });

  // --- Verdict-driven tests below ---

  test('default header icon renders when no icon prop is supplied', () => {
    const { container } = render(
      <NCredentialsCard fields={SAMPLE_FIELDS} title="Account created" />,
    );
    const iconWrapper = container.querySelector(
      '[data-testid="credentials-card-header-icon"]',
    );
    expect(iconWrapper).toBeTruthy();
    const svg = iconWrapper?.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');

    // Pin *which* icon, not merely that one rendered. `NIcon` returns null for
    // an unresolvable name, so "an svg exists" already catches a typo — but it
    // cannot tell circle-check from any other lucide glyph, and the check mark
    // is the documented default. Compare against a standalone render of the
    // same source, exactly as the explicit-icon test does for KeyRound.
    const { container: standalone } = render(
      <NIcon
        icon="circle-check"
        className="w-5 h-5 text-muted-foreground"
        aria-hidden="true"
      />,
    );
    expect(standalone.querySelector('svg')?.outerHTML).toBe(svg?.outerHTML);
  });

  test('explicit icon prop replaces the default', () => {
    const { container: withDefault } = render(
      <NCredentialsCard fields={SAMPLE_FIELDS} title="Account created" />,
    );
    const { container: withKeyRound } = render(
      <NCredentialsCard fields={SAMPLE_FIELDS} title="Account created" icon={KeyRound} />,
    );
    const defaultSvg = withDefault.querySelector(
      '[data-testid="credentials-card-header-icon"] svg',
    );
    const keyRoundSvg = withKeyRound.querySelector(
      '[data-testid="credentials-card-header-icon"] svg',
    );
    expect(defaultSvg).toBeTruthy();
    expect(keyRoundSvg).toBeTruthy();
    expect(keyRoundSvg?.outerHTML).not.toBe(defaultSvg?.outerHTML);

    const { container: standalone } = render(
      <NIcon
        icon={KeyRound}
        className="w-5 h-5 text-muted-foreground"
        aria-hidden="true"
      />,
    );
    const standaloneSvg = standalone.querySelector('svg');
    expect(standaloneSvg?.outerHTML).toBe(keyRoundSvg?.outerHTML);
  });

  test('each value isolates its own text direction', () => {
    // Credentials are weak-directionality strings. Without `dir="auto"` they
    // inherit an ambient `rtl` and paint reordered — `+1 555 0100` as
    // `0100 555 1+`. happy-dom cannot lay text out, so this pins the attribute
    // that causes the isolation; the browser acceptance asserts the resolved
    // direction and the painted result.
    const { container } = render(<NCredentialsCard fields={SAMPLE_FIELDS} />);
    const values = Array.from(container.querySelectorAll('dd'));
    expect(values.length).toBe(2);
    values.forEach((dd) => {
      expect(dd.getAttribute('dir')).toBe('auto');
    });
    // The label follows the surrounding UI direction and must not be isolated.
    container.querySelectorAll('dt').forEach((dt) => {
      expect(dt.getAttribute('dir')).toBeNull();
    });
  });

  test('header and field icons are marked decorative', () => {
    const { container } = render(
      <NCredentialsCard fields={SAMPLE_FIELDS} title="Account created" />,
    );
    const iconWrapper = container.querySelector(
      '[data-testid="credentials-card-header-icon"]',
    );
    expect(iconWrapper?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    const fields = container.querySelectorAll('[data-testid="credentials-card-field"]');
    fields.forEach((field) => {
      const iconSvg = field.querySelector('svg');
      expect(iconSvg).toBeTruthy();
      expect(iconSvg?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('copy button is disabled while a writeText promise is pending', async () => {
    vi.useFakeTimers();
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveWrite = resolve;
      }),
    );
    installClipboard({ writeText });

    const { getByRole } = render(<NCredentialsCard fields={SAMPLE_FIELDS} />);
    const button = getByRole('button', { name: /copy details/i });

    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('aria-busy')).toBeNull();

    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    // Click while pending must be a no-op
    fireEvent.click(button);
    expect(writeText).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveWrite?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.textContent).toBe('Copied');
  });

  test('status reverts to idle after roughly two seconds on success', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => undefined);
    installClipboard({ writeText });

    const { getByRole } = render(<NCredentialsCard fields={SAMPLE_FIELDS} />);
    const button = getByRole('button', { name: /copy details/i });

    fireEvent.click(button);
    await act(async () => {
      await Promise.resolve();
    });

    expect(button.textContent).toBe('Copied');

    // Just before the revert window — should still be in success state
    await act(async () => {
      vi.advanceTimersByTime(1999);
    });
    expect(button.textContent).toBe('Copied');

    // Crossing the two-second mark — should revert to idle
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(button.textContent).toBe('Copy details');
  });

  test('starting a second copy clears the previous revert timer', async () => {
    vi.useFakeTimers();
    const resolvers: Array<() => void> = [];
    const writeText = vi.fn(
      () => new Promise<void>((resolve) => {
        resolvers.push(resolve);
      }),
    );
    installClipboard({ writeText });

    const { getByRole } = render(<NCredentialsCard fields={SAMPLE_FIELDS} />);
    const button = getByRole('button', { name: /copy details/i });

    // First copy resolves immediately and shows "Copied"
    fireEvent.click(button);
    await act(async () => {
      resolvers.shift()?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(button.textContent).toBe('Copied');

    // Advance 1500ms — still within the 2000ms revert window
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(button.textContent).toBe('Copied');

    // Second copy before the first timer fires
    fireEvent.click(button);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(writeText).toHaveBeenCalledTimes(2);

    // Advance past the FIRST copy's original revert window
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    // Still pending because the second writeText hasn't resolved yet
    expect(button.getAttribute('aria-busy')).toBe('true');

    // Resolve the second copy
    await act(async () => {
      resolvers.shift()?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(button.textContent).toBe('Copied');
  });

  test('synchronously thrown copyText lands in the error state and calls onCopyError', () => {
    const failure = new Error('synchronous copy failure');
    const copyText = vi.fn(() => {
      throw failure;
    });
    const onCopyError = vi.fn();
    const writeText = vi.fn(async () => undefined);
    installClipboard({ writeText });

    const { getByRole } = render(
      <NCredentialsCard
        fields={SAMPLE_FIELDS}
        copyText={copyText}
        copyErrorLabel="Copy failed"
        onCopyError={onCopyError}
      />,
    );
    fireEvent.click(getByRole('button', { name: /copy details/i }));

    expect(copyText).toHaveBeenCalledTimes(1);
    expect(onCopyError).toHaveBeenCalledTimes(1);
    expect(onCopyError.mock.calls[0]?.[0]).toBe(failure);
    expect(writeText).not.toHaveBeenCalled();
    expect(getByRole('button', { name: /copy failed/i })).toBeTruthy();
  });

  test('synchronously thrown clipboard.writeText also lands in the error state', () => {
    const failure = new Error('sync clipboard throw');
    const writeText = vi.fn(() => {
      throw failure;
    });
    installClipboard({ writeText });
    const onCopyError = vi.fn();

    const { getByRole } = render(
      <NCredentialsCard fields={SAMPLE_FIELDS} onCopyError={onCopyError} />,
    );
    fireEvent.click(getByRole('button', { name: /copy details/i }));

    expect(onCopyError).toHaveBeenCalledTimes(1);
    expect(onCopyError.mock.calls[0]?.[0]).toBe(failure);
    expect(getByRole('button', { name: /copy failed/i })).toBeTruthy();
  });

  test('unmounting during a pending writeText does not throw or warn', async () => {
    let resolveWrite: (() => void) | undefined;
    const writeText = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveWrite = resolve;
      }),
    );
    installClipboard({ writeText });

    const warnings: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      warnings.push(args.map((a) => String(a)).join(' '));
    };

    try {
      const { unmount, getByRole } = render(<NCredentialsCard fields={SAMPLE_FIELDS} />);
      fireEvent.click(getByRole('button', { name: /copy details/i }));

      // Unmount while writeText is still pending
      unmount();

      await act(async () => {
        resolveWrite?.();
        await Promise.resolve();
        await Promise.resolve();
      });

      // No "setState on unmounted component" warnings
      const stateWarnings = warnings.filter(
        (w) =>
          w.includes('state update on an unmounted') ||
          w.includes('unmounted component') ||
          w.includes('memory leak'),
      );
      expect(stateWarnings).toHaveLength(0);
    } finally {
      console.error = originalError;
    }
  });

  test('Copy button renders before the consumer Done button in the action row', () => {
    const { container } = render(
      <NCredentialsCard
        fields={SAMPLE_FIELDS}
        actions={<button type="button">Done</button>}
      />,
    );
    const actions = container.querySelector('[data-testid="credentials-card-actions"]');
    expect(actions).toBeTruthy();
    const buttons = Array.from(actions!.querySelectorAll('button'));
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toMatch(/copy details/i);
    expect(buttons[1].textContent).toBe('Done');
  });

  test('Copy button receives keyboard focus before consumer actions', () => {
    const { getByRole } = render(
      <NCredentialsCard
        fields={SAMPLE_FIELDS}
        actions={<button type="button">Done</button>}
      />,
    );
    const copy = getByRole('button', { name: /copy details/i });
    const done = getByRole('button', { name: 'Done' });
    copy.focus();
    expect(document.activeElement).toBe(copy);
    done.focus();
    expect(document.activeElement).toBe(done);
    // Tab order follows DOM order: Copy precedes Done
    const copyTabIndex = copy.compareDocumentPosition(done);
    expect(copyTabIndex & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
