import { describe, test, expect } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StorageStudio } from '../../src/studio/app/studio';

describe('storage studio on the server', () => {
  test('renders only its theme shell, so the client router cannot mismatch the server HTML', () => {
    const html = renderToString(<StorageStudio />);
    expect(html).toContain('ss-studio');
    expect(html).not.toContain('Notifications');
    expect(html).not.toContain('Storage Studio');
  });
});
