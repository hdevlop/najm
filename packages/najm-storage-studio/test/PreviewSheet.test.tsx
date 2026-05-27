import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewSheet } from '../src/components/preview/PreviewSheet';

describe('PreviewSheet', () => {
  test('renders file details', () => {
    const file = {
      namespace: 'prod',
      filePath: 'docs/report.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      updatedAt: new Date().toISOString(),
      tags: ['invoice'],
      url: '/prod/files/serve/docs/report.pdf',
    };
    render(<PreviewSheet file={file} onClose={() => {}} />);
    expect(screen.getByText('report.pdf')).toBeDefined();
    expect(screen.getByText('1 KB')).toBeDefined();
    expect(screen.getByText('application/pdf')).toBeDefined();
    expect(screen.getByText('prod')).toBeDefined();
  });

  test('calls onClose when X button is clicked', () => {
    let closed = false;
    const file = {
      namespace: 'prod',
      filePath: 'a.txt',
      mimeType: 'text/plain',
      size: 10,
      updatedAt: new Date().toISOString(),
      url: '/prod/files/serve/a.txt',
    };
    render(<PreviewSheet file={file} onClose={() => { closed = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(closed).toBe(true);
  });

  test('returns null when file is null', () => {
    const { container } = render(<PreviewSheet file={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
