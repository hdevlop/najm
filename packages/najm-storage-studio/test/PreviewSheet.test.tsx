import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

mock.module('najm-ui', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => {
    if (!open) return null;
    return (
      <div data-testid="dialog">
        <button data-testid="dialog-close" onClick={() => onOpenChange?.(false)} aria-label="Close">
          Close
        </button>
        {children}
      </div>
    );
  },
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  NSheet: ({ children, open, title, onOpenChange }: any) => {
    if (!open) return null;
    return (
      <div data-testid="sheet">
        <div>{title}</div>
        <button data-testid="sheet-close" onClick={() => onOpenChange?.(false)} aria-label="Close">
          Close
        </button>
        {children}
      </div>
    );
  },
}));

import { PreviewSheet } from '../src/features/preview/components/PreviewSheet';
import { FilePropertiesSheet } from '../src/features/preview/components/FilePropertiesSheet';
import { StorageStudioProvider } from '../src/providers';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
      {children}
    </StorageStudioProvider>
  );
}

describe('PreviewSheet', () => {
  test('renders only the preview dialog for click preview', () => {
    const file = {
      namespace: 'prod',
      filePath: 'docs/report.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      updatedAt: new Date().toISOString(),
      tags: ['invoice'],
      url: '/prod/files/serve/docs/report.pdf',
    };
    render(<Wrapper><PreviewSheet file={file} onClose={() => {}} /></Wrapper>);
    expect(screen.getByText('report.pdf')).toBeDefined();
    expect(screen.queryByText('1 KB')).toBeNull();
    expect(screen.queryByText('application/pdf')).toBeNull();
    expect(screen.queryByText('prod')).toBeNull();
  });

  test('calls onClose when close button is clicked', () => {
    let closed = false;
    const file = {
      namespace: 'prod',
      filePath: 'a.txt',
      mimeType: 'text/plain',
      size: 10,
      updatedAt: new Date().toISOString(),
      url: '/prod/files/serve/a.txt',
    };
    render(<Wrapper><PreviewSheet file={file} onClose={() => { closed = true; }} /></Wrapper>);
    fireEvent.click(screen.getByTestId('dialog-close'));
    expect(closed).toBe(true);
  });

  test('returns null when file is null', () => {
    const { container } = render(<Wrapper><PreviewSheet file={null} onClose={() => {}} /></Wrapper>);
    expect(container.firstChild).toBeNull();
  });

  test('can open after rendering closed without hook-order errors', () => {
    const file = {
      namespace: 'prod',
      filePath: 'docs/report.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      updatedAt: new Date().toISOString(),
      tags: [],
      url: '/prod/files/serve/docs/report.pdf',
    };
    const { rerender } = render(<Wrapper><PreviewSheet file={null} onClose={() => {}} /></Wrapper>);
    rerender(<Wrapper><PreviewSheet file={file} onClose={() => {}} /></Wrapper>);
    expect(screen.getByText('report.pdf')).toBeDefined();
  });

  test('renders file details in properties sheet', () => {
    const file = {
      namespace: 'prod',
      filePath: 'docs/report.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      updatedAt: new Date().toISOString(),
      tags: ['invoice'],
      url: '/prod/files/serve/docs/report.pdf',
    };
    render(<Wrapper><FilePropertiesSheet file={file} onClose={() => {}} /></Wrapper>);
    expect(screen.getByText('Properties')).toBeDefined();
    expect(screen.getByText('1 KB')).toBeDefined();
    expect(screen.getByText('application/pdf')).toBeDefined();
    expect(screen.getByText('prod')).toBeDefined();
    expect(screen.getByText('invoice')).toBeDefined();
  });
});
