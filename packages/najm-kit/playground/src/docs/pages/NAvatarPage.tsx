import React from 'react';
import { Badge, NAvatar } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function NAvatarPage() {
  return (
    <ComponentPage
      title="NAvatar"
      description="High-level avatar with initials fallback, color hashing, image versioning, and optional title / subtitle / meta rows."
      category="Avatar"
    >
      <Example
        title="Basic"
        description="title drives both the visible label and the initials inside the circle."
        code={`import { NAvatar } from 'najm-kit';

<NAvatar title="Jane Doe" />
<NAvatar title="Ahmed Benali" />
<NAvatar title="Charlie Brown" />`}
      >
        <div className="flex flex-col gap-3">
          <NAvatar title="Jane Doe" />
          <NAvatar title="Ahmed Benali" />
          <NAvatar title="Charlie Brown" />
        </div>
      </Example>

      <Example
        title="With image"
        description="When src is provided and valid, the image is shown. Falls back to initials if it fails to load."
        code={`<NAvatar
  src="https://github.com/shadcn.png"
  title="Najm User"
  subtitle="admin@example.com"
/>`}
      >
        <NAvatar
          src="https://github.com/shadcn.png"
          title="Najm User"
          subtitle="admin@example.com"
        />
      </Example>

      <Example
        title="Fallback string"
        description="Use fallback to render a custom string inside the circle directly — useful for service icons or abbreviations that aren't a person's name."
        code={`<NAvatar fallback="API" />
<NAvatar fallback="DB" />
<NAvatar fallback="+" />`}
      >
        <div className="flex items-center gap-4">
          <NAvatar fallback="API" />
          <NAvatar fallback="DB" />
          <NAvatar fallback="+" />
        </div>
      </Example>

      <Example
        title="Sizes"
        description="Four sizes: sm, md (default), lg, xl."
        code={`<NAvatar size="sm" src="https://github.com/shadcn.png" />
<NAvatar size="md" src="https://github.com/shadcn.png" />
<NAvatar size="lg" src="https://github.com/shadcn.png" />
<NAvatar size="xl" src="https://github.com/shadcn.png" />`}
      >
        <div className="flex items-center gap-4">
          <NAvatar size="sm" src="https://github.com/shadcn.png" />
          <NAvatar size="md" src="https://github.com/shadcn.png" />
          <NAvatar size="lg" src="https://github.com/shadcn.png" />
          <NAvatar size="xl" src="https://github.com/shadcn.png" />
        </div>
      </Example>

      <Example
        title="Shapes"
        description="circle (default), rounded, and square."
        code={`<NAvatar src="https://github.com/shadcn.png" shape="circle" size="lg" />
<NAvatar src="https://github.com/shadcn.png" shape="rounded" size="lg" />
<NAvatar src="https://github.com/shadcn.png" shape="square" size="lg" />`}
      >
        <div className="flex items-center gap-4">
          <NAvatar src="https://github.com/shadcn.png" shape="circle" size="lg" />
          <NAvatar src="https://github.com/shadcn.png" shape="rounded" size="lg" />
          <NAvatar src="https://github.com/shadcn.png" shape="square" size="lg" />
        </div>
      </Example>

      <Example
        title="Profile rows"
        description="Add subtitle and meta for user lists, tables, and activity feeds. meta accepts any ReactNode."
        code={`<NAvatar title="Alice Johnson" subtitle="alice@example.com" meta="Owner" />
<NAvatar
  title="Bob Smith"
  subtitle="Product Designer"
  meta={<Badge color="success" look="soft">Active</Badge>}
/>
<NAvatar title="Eve Wilson" subtitle="Developer" meta="Remote" size="lg" />`}
      >
        <div className="flex flex-col gap-3">
          <NAvatar title="Alice Johnson" subtitle="alice@example.com" meta="Owner" />
          <NAvatar
            title="Bob Smith"
            subtitle="Product Designer"
            meta={<Badge color="success" look="soft">Active</Badge>}
          />
          <NAvatar title="Eve Wilson" subtitle="Developer" meta="Remote" size="lg" />
        </div>
      </Example>

      <Example
        title="Image fallback"
        description="fallbackSrc is shown when src is null, undefined, or the sentinel 'noavatar.png'."
        code={`<NAvatar
  src="noavatar.png"
  fallbackSrc="https://github.com/shadcn.png"
  title="From fallbackSrc"
/>
<NAvatar
  src={null}
  fallbackSrc="https://github.com/vercel.png"
  title="Null src"
/>`}
      >
        <div className="flex flex-col gap-3">
          <NAvatar
            src="noavatar.png"
            fallbackSrc="https://github.com/shadcn.png"
            title="From fallbackSrc"
          />
          <NAvatar
            src={null}
            fallbackSrc="https://github.com/vercel.png"
            title="Null src"
          />
        </div>
      </Example>

      <Example
        title="Cache busting"
        description="Pass version or srcVersion to append ?v= to the URL so browsers re-fetch after an upload."
        code={`<NAvatar
  src="https://github.com/github.png"
  version="profile-2"
  title="Versioned"
  subtitle="?v=profile-2 appended"
/>`}
      >
        <NAvatar
          src="https://github.com/github.png"
          version="profile-2"
          title="Versioned"
          subtitle="?v=profile-2 appended"
        />
      </Example>

      <Example
        title="classNames"
        description="Target individual parts without overriding the whole structure."
        code={`<NAvatar
  title="Styled User"
  subtitle="custom classes applied"
  classNames={{
    root: 'rounded-md border p-3',
    title: 'text-primary font-bold',
    subtitle: 'italic',
  }}
/>`}
      >
        <NAvatar
          title="Styled User"
          subtitle="custom classes applied"
          classNames={{
            root: 'rounded-md border p-3',
            title: 'text-primary font-bold',
            subtitle: 'italic',
          }}
        />
      </Example>
    </ComponentPage>
  );
}
