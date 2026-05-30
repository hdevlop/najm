import React, { useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, test, expect } from 'bun:test';
import { useEscapeKey } from '../../src/studio/shared/hooks/useEscapeKey';
import { useClickOutside } from '../../src/studio/shared/hooks/useClickOutside';
import { useFocusTrap } from '../../src/studio/shared/hooks/useFocusTrap';

function EscapeProbe({ enabled }: { enabled: boolean }) {
  useEscapeKey(enabled, () => {});
  return <div data-testid="probe" />;
}

function ClickOutsideProbe({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, enabled, () => {});
  return <div ref={ref} data-testid="probe" />;
}

function FocusTrapProbe({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, enabled);
  return (
    <div ref={ref} data-testid="trap">
      <button type="button">A</button>
    </div>
  );
}

describe('useEscapeKey', () => {
  test('component using hook renders cleanly during SSR', () => {
    expect(() => renderToStaticMarkup(<EscapeProbe enabled />)).not.toThrow();
    expect(() => renderToStaticMarkup(<EscapeProbe enabled={false} />)).not.toThrow();
  });
});

describe('useClickOutside', () => {
  test('component using hook renders cleanly during SSR', () => {
    expect(() => renderToStaticMarkup(<ClickOutsideProbe enabled />)).not.toThrow();
    expect(() => renderToStaticMarkup(<ClickOutsideProbe enabled={false} />)).not.toThrow();
  });
});

describe('useFocusTrap', () => {
  test('component using hook renders cleanly during SSR', () => {
    expect(() => renderToStaticMarkup(<FocusTrapProbe enabled />)).not.toThrow();
    expect(() => renderToStaticMarkup(<FocusTrapProbe enabled={false} />)).not.toThrow();
  });
});
