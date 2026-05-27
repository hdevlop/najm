import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BatchActionsBar } from '../src/components/explorer/BatchActionsBar';

describe('BatchActionsBar', () => {
  test('returns null when count is 0', () => {
    const { container } = render(<BatchActionsBar count={0} onAction={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders count and action buttons', () => {
    render(<BatchActionsBar count={3} onAction={() => {}} />);
    expect(screen.getByText('3 selected')).toBeDefined();
    expect(screen.getByText('Move')).toBeDefined();
    expect(screen.getByText('Copy')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  test('calls onAction with correct action id', () => {
    let action = '';
    render(<BatchActionsBar count={2} onAction={(a) => { action = a; }} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(action).toBe('delete');
  });
});
