import React from 'react';
import { NNotFoundState } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function NotFoundStatePage() {
  return (
    <ComponentPage
      title="Not Found State"
      description="First-class 404 state for routes and missing resources. Renders at the page surface by default, with a Compass icon and provider-driven copy. Applications supply the destination link."
      category="Feedback"
    >
      <Example
        title="Default page surface"
        description="Drop-in not-found state. Pass an action slot for navigation; never a Next Link here."
        center={false}
        code={`import { NNotFoundState } from 'najm-kit';

<NNotFoundState
  action={<Link href="/dashboard">Back to dashboard</Link>}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NNotFoundState />
        </div>
      </Example>

      <Example
        title="Inline surface"
        description={`Use surface="inline" for missing-resource cards or section-level placeholders.`}
        center={false}
        code={`<NNotFoundState surface="inline" />`}
      >
        <div className="w-full max-w-md mx-auto border rounded-xl overflow-hidden">
          <NNotFoundState surface="inline" />
        </div>
      </Example>

      <Example
        title="Explicit copy"
        description="Pass title and description to override the provider defaults without changing the surface."
        center={false}
        code={`<NNotFoundState
  title="This record was removed"
  description="The page you were looking for is no longer available."
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NNotFoundState
            title="This record was removed"
            description="The page you were looking for is no longer available."
          />
        </div>
      </Example>
    </ComponentPage>
  );
}
