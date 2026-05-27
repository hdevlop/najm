import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { UploadTray } from '../src/components/upload/UploadTray';
import type { UploadTask } from '../src/hooks/useUpload';

const makeTask = (overrides: Partial<UploadTask> = {}): UploadTask => ({
  id: `task-${Math.random().toString(36).slice(2)}`,
  file: new File(['a'], overrides.file?.name ?? 'test.txt', { type: 'text/plain' }),
  progress: 50,
  status: 'uploading',
  ...overrides,
});

describe('UploadTray', () => {
  test('returns null when queue is empty', () => {
    const { container } = render(<UploadTray queue={[]} onRemove={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders file names', () => {
    const queue = [makeTask()];
    render(<UploadTray queue={queue} onRemove={() => {}} />);
    expect(screen.getByText('test.txt')).toBeDefined();
  });

  test('shows remaining count for non-done tasks', () => {
    const queue = [
      makeTask({ id: 'a', file: new File(['x'], 'a.txt') }),
      makeTask({ id: 'b', status: 'done', file: new File(['y'], 'b.txt') }),
    ];
    render(<UploadTray queue={queue} onRemove={() => {}} />);
    expect(screen.getByText(/\(1 remaining\)/)).toBeDefined();
  });

  test('calls onRemove when X button clicked', () => {
    const queue = [makeTask({ id: 'task-xyz' })];
    let removed = '';
    render(<UploadTray queue={queue} onRemove={(id) => { removed = id; }} />);
    const btns = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(btns[0]);
    expect(removed).toBe('task-xyz');
  });
});
