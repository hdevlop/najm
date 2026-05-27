import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ContextMenu } from '../src/components/explorer/ContextMenu';

const defaultItems = [
  { id: 'download', label: 'Download' },
  { id: 'rename', label: 'Rename' },
  { id: 'copy', label: 'Copy' },
  { id: 'share', label: 'Share' },
  { id: 'delete', label: 'Delete', danger: true },
];

describe('ContextMenu', () => {
  test('renders all menu items', () => {
    render(<ContextMenu x={100} y={100} items={defaultItems} onAction={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Download')).toBeDefined();
    expect(screen.getByText('Rename')).toBeDefined();
    expect(screen.getByText('Copy')).toBeDefined();
    expect(screen.getByText('Share')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  test('calls onAction and onClose when item clicked', () => {
    let action = '';
    let closed = false;
    render(
      <ContextMenu
        x={100}
        y={100}
        items={defaultItems}
        onAction={(a) => { action = a; }}
        onClose={() => { closed = true; }}
      />,
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(action).toBe('delete');
    expect(closed).toBe(true);
  });

  test('calls onClose when backdrop clicked', () => {
    let closed = false;
    const { container } = render(
      <ContextMenu x={100} y={100} items={defaultItems} onAction={() => {}} onClose={() => { closed = true; }} />,
    );
    // The backdrop is the first div child (fixed inset-0 z-40)
    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(closed).toBe(true);
  });

  test('delete item has red text', () => {
    render(<ContextMenu x={100} y={100} items={defaultItems} onAction={() => {}} onClose={() => {}} />);
    const btn = screen.getByText('Delete').closest('button');
    expect(btn?.className).toContain('text-red-400');
  });
});
