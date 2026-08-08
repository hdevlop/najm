import React from 'react';
import { NButton, NBadge, statusTextClass } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const COLORS = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'info',
  'success',
  'warning',
  'destructive',
] as const;

const LABELS: Record<(typeof COLORS)[number], string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  neutral: 'Neutral',
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  destructive: 'Error',
};

const STATUS_BADGES = [
  { label: 'Active', color: 'success' },
  { label: 'Pending', color: 'warning' },
  { label: 'Failed', color: 'destructive' },
  { label: 'Draft', color: 'neutral' },
  { label: 'Completed', color: 'success' },
  { label: 'Paused', color: 'warning' },
  { label: 'Archived', color: 'neutral' },
] as const;

const BUILT_IN_STATUSES = [
  'approved',
  'pending_review',
  'out_for_delivery',
  'paused',
  'archived',
  'refunded',
  'nebulous',
] as const;

const ICON_MAP = {
  success: 'circle-check',
  warning: 'alert-circle',
  accent: 'hourglass',
  info: 'info',
  neutral: 'ban',
  destructive: 'circle-x',
};

function codeFor(look: string) {
  return COLORS.map(
    (c) => `<NBadge color="${c}"${look === 'solid' ? '' : ` look="${look}"`} label="${LABELS[c]}" />`
  ).join('\n');
}

export function BadgePage() {
  return (
    <ComponentPage
      title="Badge"
      description="Small status labels for categorizing or tagging content with a brief descriptor."
      category="Data Display"
    >
      <Example code={codeFor('solid')}>
        {COLORS.map((c) => (
          <NBadge key={c} color={c} label={LABELS[c]} />
        ))}
      </Example>

      <Example title="Badge with soft style" code={codeFor('soft')}>
        {COLORS.map((c) => (
          <NBadge key={c} color={c} look="soft" label={LABELS[c]} />
        ))}
      </Example>

      <Example title="Badge with outline style" code={codeFor('outline')}>
        {COLORS.map((c) => (
          <NBadge key={c} color={c} look="outline" label={LABELS[c]} />
        ))}
      </Example>

      <Example title="Badge with dash style" code={codeFor('dash')}>
        {COLORS.map((c) => (
          <NBadge key={c} color={c} look="dash" label={LABELS[c]} />
        ))}
      </Example>

      <Example
        title="Sizes"
        description="Use the size prop to scale the badge."
        code={`<NBadge color="primary" size="sm" label="Small" />
<NBadge color="primary" size="md" label="Medium" />
<NBadge color="primary" size="lg" label="Large" />`}
      >
        <NBadge color="primary" size="sm" label="Small" />
        <NBadge color="primary" size="md" label="Medium" />
        <NBadge color="primary" size="lg" label="Large" />
      </Example>

      <Example
        title="Rounded shapes"
        description="Use the shape prop to switch between default, pill, and square corners."
        code={`<NBadge color="success" look="soft" shape="default" label="Default" />
<NBadge color="success" look="soft" shape="pill" label="Pill" />
<NBadge color="success" look="soft" shape="square" label="Square" />

<NBadge color="info" shape="pill" label="Info" />
<NBadge color="warning" look="outline" shape="pill" label="Warning" />
<NBadge color="destructive" look="dash" shape="pill" label="Error" />`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <NBadge color="success" look="soft" shape="default" label="Default" />
          <NBadge color="success" look="soft" shape="pill" label="Pill" />
          <NBadge color="success" look="soft" shape="square" label="Square" />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <NBadge color="info" shape="pill" label="Info" />
          <NBadge color="warning" look="outline" shape="pill" label="Warning" />
          <NBadge color="destructive" look="dash" shape="pill" label="Error" />
        </div>
      </Example>

      <Example
        title="Badge with icon"
        description="Pass showIcon with a lucide string, component, element, or image source."
        code={`<NBadge color="info" look="soft" showIcon icon="info" label="Info" />
<NBadge color="success" look="soft" showIcon icon="circle-check" label="Success" />
<NBadge color="warning" look="soft" showIcon icon="triangle-alert" label="Warning" />
<NBadge color="destructive" look="soft" showIcon icon="ban" label="Error" />`}
      >
        <NBadge color="info" look="soft" showIcon icon="info" label="Info" />
        <NBadge color="success" look="soft" showIcon icon="circle-check" label="Success" />
        <NBadge color="warning" look="soft" showIcon icon="triangle-alert" label="Warning" />
        <NBadge color="destructive" look="soft" showIcon icon="ban" label="Error" />
      </Example>

      <Example
        title="Badge in a text"
        description="Badges sit inline next to headings and paragraphs."
        center={false}
        code={`<h1 className="text-3xl font-bold">Heading 1 <NBadge color="neutral" look="soft" label="Badge" /></h1>
<h2 className="text-2xl font-bold">Heading 2 <NBadge color="neutral" look="soft" label="Badge" /></h2>
<h3 className="text-xl font-bold">Heading 3 <NBadge color="neutral" look="soft" label="Badge" /></h3>
<h4 className="text-lg font-bold">Heading 4 <NBadge color="neutral" look="soft" size="sm" label="Badge" /></h4>
<h5 className="text-base font-bold">Heading 5 <NBadge color="neutral" look="soft" size="sm" label="Badge" /></h5>
<p className="text-sm">Paragraph <NBadge color="neutral" look="soft" size="sm" label="Badge" /></p>`}
      >
        <div className="space-y-3">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            Heading 1 <NBadge color="neutral" look="soft" label="Badge" />
          </h1>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            Heading 2 <NBadge color="neutral" look="soft" label="Badge" />
          </h2>
          <h3 className="flex items-center gap-2 text-xl font-bold">
            Heading 3 <NBadge color="neutral" look="soft" label="Badge" />
          </h3>
          <h4 className="flex items-center gap-2 text-lg font-bold">
            Heading 4 <NBadge color="neutral" look="soft" size="sm" label="Badge" />
          </h4>
          <h5 className="flex items-center gap-2 text-base font-bold">
            Heading 5 <NBadge color="neutral" look="soft" size="sm" label="Badge" />
          </h5>
          <p className="flex items-center gap-2 text-sm">
            Paragraph <NBadge color="neutral" look="soft" size="sm" label="Badge" />
          </p>
        </div>
      </Example>

      <Example
        title="Badge in a button"
        description="Combine a label with a count badge inside a button."
        code={`<NButton>Inbox <NBadge color="neutral" look="soft" size="sm" label="+99" /></NButton>
<NButton variant="secondary">Inbox <NBadge color="primary" look="soft" size="sm" label="+99" /></NButton>`}
      >
        <NButton>
          Inbox <NBadge color="neutral" look="soft" size="sm" label="+99" />
        </NButton>
        <NButton variant="secondary">
          Inbox <NBadge color="primary" look="soft" size="sm" label="+99" />
        </NButton>
      </Example>

      <Example
        title="Semantic examples"
        description="Use NBadge colors directly for common application states."
        code={`<NBadge color="success" look="soft" label="Active" />
<NBadge color="warning" look="soft" label="Pending" />
<NBadge color="destructive" look="soft" label="Failed" />
<NBadge color="neutral" look="soft" label="Draft" />
<NBadge color="success" look="soft" label="Completed" />
<NBadge color="warning" look="soft" label="Paused" />
<NBadge color="neutral" look="soft" label="Archived" />`}
      >
        {STATUS_BADGES.map((s) => (
          <NBadge key={s.label} color={s.color} look="soft" label={s.label} />
        ))}
      </Example>

      <Example
        title="Semantic examples with icons"
        description="Pass showIcon with an iconMap to auto-match icons to colors."
        code={`<NBadge color="success" look="soft" showIcon icon="circle-check" label="Active" />
<NBadge color="warning" look="soft" showIcon icon="triangle-alert" label="Pending" />
<NBadge color="destructive" look="soft" showIcon icon="ban" label="Failed" />
<NBadge color="info" look="soft" showIcon icon="info" label="Processing" />`}
      >
        <NBadge color="success" look="soft" showIcon icon="circle-check" label="Active" />
        <NBadge color="warning" look="soft" showIcon icon="triangle-alert" label="Pending" />
        <NBadge color="destructive" look="soft" showIcon icon="ban" label="Failed" />
        <NBadge color="info" look="soft" showIcon icon="info" label="Processing" />
      </Example>

      <Example
        title="Built-in status vocabulary"
        description="Pass status alone: NAJM_STATUS_COLORS colors it, the token is humanized into the label, and anything unrecognized lands on neutral."
        code={`<NBadge status="approved" look="soft" shape="pill" />
<NBadge status="pending_review" look="soft" shape="pill" />
<NBadge status="out_for_delivery" look="soft" shape="pill" />
<NBadge status="paused" look="soft" shape="pill" />
<NBadge status="archived" look="soft" shape="pill" />
<NBadge status="refunded" look="soft" shape="pill" />
<NBadge status="nebulous" look="soft" shape="pill" />`}
      >
        {BUILT_IN_STATUSES.map((s) => (
          <NBadge key={s} status={s} look="soft" shape="pill" />
        ))}
      </Example>

      <Example
        title="Status text without a badge"
        description="statusTextClass returns the matching text color for prose or numbers that must agree with a nearby badge. An unmapped status returns '' and keeps the surrounding color."
        code={`<span className={statusTextClass('validated')}>+1,200.00 MAD</span>
<span className={statusTextClass('pending')}>+450.00 MAD</span>
<span className={statusTextClass('refunded')}>-320.00 MAD</span>
<span className={statusTextClass('nebulous')}>+80.00 MAD</span>`}
      >
        {(['validated', 'pending', 'refunded', 'nebulous'] as const).map((s) => (
          <span key={s} className={`text-sm font-semibold ${statusTextClass(s)}`}>
            {s} +1,200.00 MAD
          </span>
        ))}
      </Example>

      <Example
        title="Status mapping"
        description="Pass a statusMap to override single keys — it is consulted before the built-in vocabulary, and unlisted keys still fall through to it."
        code={`const STATUS_MAP = { active: 'success', pending: 'accent', inactive: 'neutral', rejected: 'destructive' };
const ICON_MAP = { success: 'circle-check', accent: 'hourglass', neutral: 'ban', destructive: 'circle-x' };

<NBadge status="active" statusMap={STATUS_MAP} showIcon iconMap={ICON_MAP} />
<NBadge status="pending" statusMap={STATUS_MAP} showIcon iconMap={ICON_MAP} />
<NBadge status="inactive" statusMap={STATUS_MAP} showIcon iconMap={ICON_MAP} />
<NBadge status="rejected" statusMap={STATUS_MAP} showIcon iconMap={ICON_MAP} />`}
      >
        {(['active', 'pending', 'inactive', 'rejected'] as const).map((s) => (
          <NBadge
            key={s}
            status={s}
            statusMap={{ active: 'success', pending: 'accent', inactive: 'neutral', rejected: 'destructive' }}
            showIcon
            iconMap={ICON_MAP}
          />
        ))}
      </Example>

      <Example
        title="Minimal and text looks"
        description="Use look='minimal' or look='text' for lightweight inline status labels without borders or backgrounds."
        code={`<NBadge color="success" look="minimal" label="Active" />
<NBadge color="warning" look="minimal" label="Pending" />
<NBadge color="destructive" look="minimal" label="Failed" />

<NBadge color="success" look="text" label="Active" />
<NBadge color="warning" look="text" label="Pending" />
<NBadge color="destructive" look="text" label="Failed" />`}
      >
        <NBadge color="success" look="minimal" label="Active" />
        <NBadge color="warning" look="minimal" label="Pending" />
        <NBadge color="destructive" look="minimal" label="Failed" />
        <NBadge color="success" look="text" label="Active" />
        <NBadge color="warning" look="text" label="Pending" />
        <NBadge color="destructive" look="text" label="Failed" />
      </Example>
    </ComponentPage>
  );
}
