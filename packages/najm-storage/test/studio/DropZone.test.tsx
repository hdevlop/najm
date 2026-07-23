import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DropZone } from '../../src/studio/features/upload/components/DropZone';

describe('DropZone', () => {
  test('renders children', () => {
    render(
      <DropZone onDrop={() => {}}>
        <div data-testid="child">content</div>
      </DropZone>,
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  test('shows overlay on dragenter', () => {
    const { container } = render(
      <DropZone onDrop={() => {}}>
        <div>content</div>
      </DropZone>,
    );

    fireEvent.dragEnter(container.firstElementChild!, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('Drop files to upload')).toBeDefined();
  });

  test('hides overlay on dragleave', () => {
    const { container } = render(
      <DropZone onDrop={() => {}}>
        <div>content</div>
      </DropZone>,
    );

    const zone = container.firstElementChild!;
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('Drop files to upload')).toBeDefined();

    fireEvent.dragLeave(zone, { dataTransfer: { types: ['Files'] } });
    expect(screen.queryByText('Drop files to upload')).toBeNull();
  });
});
