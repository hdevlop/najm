import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, test, expect } from 'bun:test';
import { cn } from '../src/lib/utils';
import { Button } from '../src/components/ui/Button';
import { IconButton } from '../src/components/ui/IconButton';
import { Input } from '../src/components/ui/Input';
import { SearchInput } from '../src/components/ui/SearchInput';
import { Select } from '../src/components/ui/Select';
import { SegmentedControl } from '../src/components/ui/SegmentedControl';
import { Badge } from '../src/components/ui/Badge';
import { StatusPill } from '../src/components/ui/StatusPill';
import { Skeleton, SkeletonText } from '../src/components/ui/Skeleton';
import { Spinner } from '../src/components/ui/Spinner';
import { LoadingState } from '../src/components/ui/LoadingState';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ErrorState } from '../src/components/ui/ErrorState';
import { Dialog, Sheet } from '../src/components/ui/Dialog';
import { Tooltip } from '../src/components/ui/Tooltip';

describe('cn utility', () => {
  test('merges conditional classes', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  test('tailwind-merge removes conflicting utilities', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('Button', () => {
  test('renders as button with type=button by default', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html.startsWith('<button')).toBe(true);
    expect(html).toContain('type="button"');
    expect(html).toContain('Save');
  });

  test('applies primary variant by default', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toContain('bg-brand');
  });

  test('applies destructive variant classes', () => {
    const html = renderToStaticMarkup(<Button variant="destructive">Delete</Button>);
    expect(html).toContain('bg-red-500/90');
  });

  test('disables and marks aria-busy when loading', () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
  });

  test('shows leading icon when not loading', () => {
    const html = renderToStaticMarkup(
      <Button leadingIcon={<svg data-testid="icon" />}>Save</Button>
    );
    expect(html).toContain('data-testid="icon"');
  });

  test('hides leading icon while loading', () => {
    const html = renderToStaticMarkup(
      <Button loading leadingIcon={<svg data-testid="icon" />}>Save</Button>
    );
    expect(html).not.toContain('data-testid="icon"');
  });
});

describe('IconButton', () => {
  test('requires and renders aria-label', () => {
    const html = renderToStaticMarkup(
      <IconButton aria-label="Close panel">
        <span>x</span>
      </IconButton>
    );
    expect(html).toContain('aria-label="Close panel"');
  });

  test('marks aria-pressed when active', () => {
    const html = renderToStaticMarkup(
      <IconButton aria-label="Toggle" active>
        x
      </IconButton>
    );
    expect(html).toContain('aria-pressed="true"');
  });
});

describe('Input', () => {
  test('renders input element', () => {
    const html = renderToStaticMarkup(<Input placeholder="Type..." />);
    expect(html).toContain('<input');
    expect(html).toContain('placeholder="Type..."');
  });

  test('marks aria-invalid when invalid', () => {
    const html = renderToStaticMarkup(<Input invalid />);
    expect(html).toContain('aria-invalid="true"');
  });

  test('wraps with icon container when leadingIcon provided', () => {
    const html = renderToStaticMarkup(<Input leadingIcon={<span>i</span>} />);
    expect(html).toContain('relative');
    expect(html).toContain('pl-8');
  });
});

describe('SearchInput', () => {
  test('renders with searchbox role and aria-label', () => {
    const html = renderToStaticMarkup(<SearchInput value="" onChange={() => {}} />);
    expect(html).toContain('role="searchbox"');
    expect(html).toContain('aria-label');
  });

  test('shows clear button when value is present and onClear provided', () => {
    const html = renderToStaticMarkup(
      <SearchInput value="hello" onChange={() => {}} onClear={() => {}} />
    );
    expect(html).toContain('aria-label="Clear search"');
  });

  test('hides clear button when value empty', () => {
    const html = renderToStaticMarkup(
      <SearchInput value="" onChange={() => {}} onClear={() => {}} />
    );
    expect(html).not.toContain('aria-label="Clear search"');
  });
});

describe('Select', () => {
  test('renders select with options', () => {
    const html = renderToStaticMarkup(
      <Select
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
      />
    );
    expect(html).toContain('<select');
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
  });

  test('renders placeholder option', () => {
    const html = renderToStaticMarkup(
      <Select
        placeholder="Pick one"
        value=""
        onChange={() => {}}
        options={[{ value: 'a', label: 'Alpha' }]}
      />
    );
    expect(html).toContain('Pick one');
  });
});

describe('SegmentedControl', () => {
  test('renders as radiogroup with options', () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        ariaLabel="View"
        value="list"
        onChange={() => {}}
        options={[
          { value: 'list', label: 'List' },
          { value: 'grid', label: 'Grid' },
        ]}
      />
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="View"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
  });
});

describe('Badge', () => {
  test('renders text and variant classes', () => {
    const html = renderToStaticMarkup(<Badge variant="success">Done</Badge>);
    expect(html).toContain('Done');
    expect(html).toContain('text-emerald-300');
  });

  test('outline variant uses transparent background', () => {
    const html = renderToStaticMarkup(<Badge variant="brand" outline>Beta</Badge>);
    expect(html).toContain('bg-transparent');
  });
});

describe('StatusPill', () => {
  test('renders label and tone color', () => {
    const html = renderToStaticMarkup(<StatusPill tone="success" label="Healthy" />);
    expect(html).toContain('Healthy');
    expect(html).toContain('bg-emerald-400');
  });

  test('adds pulse marker when pulse=true', () => {
    const html = renderToStaticMarkup(<StatusPill tone="brand" pulse label="Live" />);
    expect(html).toContain('animate-ping');
  });
});

describe('Skeleton', () => {
  test('renders animated pulse', () => {
    const html = renderToStaticMarkup(<Skeleton width={120} height={20} />);
    expect(html).toContain('animate-pulse');
    expect(html).toContain('aria-hidden="true"');
  });

  test('SkeletonText renders requested lines', () => {
    const html = renderToStaticMarkup(<SkeletonText lines={4} />);
    const matches = html.match(/animate-pulse/g) ?? [];
    expect(matches.length).toBe(4);
  });
});

describe('Spinner', () => {
  test('exposes role=status and label', () => {
    const html = renderToStaticMarkup(<Spinner label="Fetching" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Fetching"');
    expect(html).toContain('Fetching');
  });
});

describe('LoadingState', () => {
  test('renders title and description', () => {
    const html = renderToStaticMarkup(
      <LoadingState title="Loading files" description="Hang tight" />
    );
    expect(html).toContain('Loading files');
    expect(html).toContain('Hang tight');
    expect(html).toContain('role="status"');
  });
});

describe('EmptyState', () => {
  test('renders title and action', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No buckets yet" action={<button type="button">Create</button>} />
    );
    expect(html).toContain('No buckets yet');
    expect(html).toContain('Create');
  });
});

describe('ErrorState', () => {
  test('renders error message from Error instance', () => {
    const html = renderToStaticMarkup(<ErrorState error={new Error('boom')} />);
    expect(html).toContain('boom');
    expect(html).toContain('role="alert"');
  });

  test('renders retry button when onRetry provided', () => {
    const html = renderToStaticMarkup(<ErrorState onRetry={() => {}} />);
    expect(html).toContain('Retry');
  });

  test('omits retry button when onRetry missing', () => {
    const html = renderToStaticMarkup(<ErrorState />);
    expect(html).not.toContain('>Retry<');
  });
});

describe('Dialog', () => {
  test('returns null when closed', () => {
    const html = renderToStaticMarkup(<Dialog open={false} onClose={() => {}} title="Hi" />);
    expect(html).toBe('');
  });

  test('renders dialog role and title when open', () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => {}} title="Confirm" description="Are you sure?">
        Body
      </Dialog>
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Confirm');
    expect(html).toContain('Are you sure?');
    expect(html).toContain('Body');
    expect(html).toContain('aria-label="Close dialog"');
  });
});

describe('Sheet', () => {
  test('returns null when closed', () => {
    const html = renderToStaticMarkup(<Sheet open={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  test('renders title when open', () => {
    const html = renderToStaticMarkup(
      <Sheet open onClose={() => {}} title="Preview" side="right">
        contents
      </Sheet>
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Preview');
    expect(html).toContain('contents');
  });
});

describe('Tooltip', () => {
  test('renders child element with aria-describedby off when closed', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Help">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    expect(html).toContain('Trigger');
    expect(html).not.toContain('role="tooltip"');
  });
});
