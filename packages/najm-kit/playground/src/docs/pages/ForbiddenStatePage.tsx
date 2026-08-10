import React from 'react';
import { NForbiddenState } from 'najm-kit';
import { ShieldAlert } from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function ForbiddenStatePage() {
  return (
    <ComponentPage
      title="Forbidden State"
      description={`First-class "access denied" state. Renders at the page surface by default, with a ShieldOff icon and provider-driven copy. Applications supply the action, route target, and authorization policy.`}
      category="Feedback"
    >
      <Example
        title="Default page surface"
        description="Drop-in forbidden state with the provider's copy. Pass an action slot for navigation, but never a Next Link here — that's the application's job."
        center={false}
        code={`import { NForbiddenState } from 'najm-kit';

<NForbiddenState
  action={<Link href="/dashboard">Back to dashboard</Link>}
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NForbiddenState />
        </div>
      </Example>

      <Example
        title="Inline surface"
        description={`Use surface="inline" when the forbidden state lives inside an existing card or section.`}
        center={false}
        code={`<NForbiddenState surface="inline" />`}
      >
        <div className="w-full max-w-md mx-auto border rounded-xl overflow-hidden">
          <NForbiddenState surface="inline" />
        </div>
      </Example>

      <Example
        title="Custom icon"
        description="Pass a Lucide component or a React element to override the ShieldOff default."
        center={false}
        code={`<NForbiddenState icon={ShieldAlert} />`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NForbiddenState icon={ShieldAlert} />
        </div>
      </Example>

      <Example
        title="Explicit title and description"
        description="Pass title and description to override the provider defaults without changing the surface."
        center={false}
        code={`<NForbiddenState
  title="Admins only"
  description="Ask an administrator to grant you access."
/>`}
      >
        <div className="w-full border rounded-xl overflow-hidden">
          <NForbiddenState
            title="Admins only"
            description="Ask an administrator to grant you access."
          />
        </div>
      </Example>
    </ComponentPage>
  );
}
