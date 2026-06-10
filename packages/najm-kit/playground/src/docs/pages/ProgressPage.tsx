import React, { useEffect, useState } from 'react';
import { Progress } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const colors = [
  { color: 'primary' as const, label: 'Primary' },
  { color: 'secondary' as const, label: 'Secondary' },
  { color: 'accent' as const, label: 'Accent' },
  { color: 'neutral' as const, label: 'Neutral' },
  { color: 'success' as const, label: 'Success' },
  { color: 'warning' as const, label: 'Warning' },
  { color: 'error' as const, label: 'Error' },
  { color: 'info' as const, label: 'Info' },
];

const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

function AnimatedProgress() {
  const [value, setValue] = useState(30);

  useEffect(() => {
    const t = setInterval(() => setValue((v) => (v >= 100 ? 0 : v + 10)), 800);
    return () => clearInterval(t);
  }, []);

  return <Progress value={value} className="w-full max-w-sm" />;
}

export function ProgressPage() {
  return (
    <ComponentPage
      title="Progress"
      description="Displays an indicator showing the completion progress of a task, typically displayed as a progress bar."
      category="Data Display"
    >
      <Example
        title="Default"
        description="Basic progress bar with different fill values."
        code={`import { Progress } from 'najm-kit';

<Progress value={0} />
<Progress value={25} />
<Progress value={50} />
<Progress value={75} />
<Progress value={100} />`}
        center={false}
      >
        <div className="w-full space-y-1.5 max-w-sm">
          {[0, 25, 50, 75, 100].map((v) => (
            <Progress key={v} value={v} />
          ))}
        </div>
      </Example>

      <Example
        title="Colors"
        description="All available color variants at 60% fill."
        code={`<Progress value={60} color="primary" />
<Progress value={60} color="secondary" />
<Progress value={60} color="accent" />
<Progress value={60} color="neutral" />
<Progress value={60} color="success" />
<Progress value={60} color="warning" />
<Progress value={60} color="error" />
<Progress value={60} color="info" />`}
        center={false}
      >
        <div className="w-full space-y-2 max-w-sm">
          {colors.map(({ color, label }) => (
            <div key={color} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">{label}</span>
              <Progress value={60} color={color} className="flex-1" />
            </div>
          ))}
        </div>
      </Example>

      <Example
        title="Sizes"
        description="From xs to xl — no extra classes needed."
        code={`<Progress value={60} size="xs" />
<Progress value={60} size="sm" />
<Progress value={60} size="md" />
<Progress value={60} size="lg" />
<Progress value={60} size="xl" />`}
        center={false}
      >
        <div className="w-full space-y-3 max-w-sm">
          {sizes.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-6 text-right font-mono">{s}</span>
              <Progress value={60} size={s} className="flex-1" />
            </div>
          ))}
        </div>
      </Example>

      <Example
        title="With label inside"
        description="Shows the percentage text inside the filled bar. Works best with size lg and xl."
        code={`<Progress value={75} size="lg" label="75%" labelPosition="inside" />
<Progress value={50} size="xl" label="50%" labelPosition="inside" />
<Progress value={90} size="xl" label="90%" labelPosition="inside" color="success" />`}
        center={false}
      >
        <div className="w-full space-y-3 max-w-sm">
          <Progress value={75} size="lg" label="75%" labelPosition="inside" />
          <Progress value={50} size="xl" label="50%" labelPosition="inside" />
          <Progress value={90} size="xl" label="90%" labelPosition="inside" color="success" />
        </div>
      </Example>

      <Example
        title="With label outside top"
        description="Label above the bar with percentage on the right."
        code={`<Progress value={75} label="Upload" labelPosition="outside-top" />
<Progress value={40} label="Processing" labelPosition="outside-top" color="warning" />
<Progress value={100} label="Complete" labelPosition="outside-top" color="success" />`}
        center={false}
      >
        <div className="w-full space-y-4 max-w-sm">
          <Progress value={75} label="Upload" labelPosition="outside-top" />
          <Progress value={40} label="Processing" labelPosition="outside-top" color="warning" />
          <Progress value={100} label="Complete" labelPosition="outside-top" color="success" />
        </div>
      </Example>

      <Example
        title="With label outside right"
        description="Percentage displayed to the right of the bar."
        code={`<Progress value={60} labelPosition="outside-right" />
<Progress value={30} labelPosition="outside-right" color="error" />
<Progress value={85} labelPosition="outside-right" color="info" />`}
        center={false}
      >
        <div className="w-full space-y-3 max-w-sm">
          <Progress value={60} labelPosition="outside-right" />
          <Progress value={30} labelPosition="outside-right" color="error" />
          <Progress value={85} labelPosition="outside-right" color="info" />
        </div>
      </Example>

      <Example
        title="Indeterminate"
        description="No value needed — shows a loading animation."
        code={`<Progress indeterminate />
<Progress indeterminate color="success" />
<Progress indeterminate color="warning" size="lg" />`}
        center={false}
      >
        <div className="w-full space-y-4 max-w-sm">
          <Progress indeterminate />
          <Progress indeterminate color="success" />
          <Progress indeterminate color="warning" size="lg" />
        </div>
      </Example>

      <Example
        title="Animated"
        description="Progress bar with a changing value."
        code={`const [value, setValue] = useState(30);

useEffect(() => {
  const t = setInterval(() => setValue((v) => (v >= 100 ? 0 : v + 10)), 800);
  return () => clearInterval(t);
}, []);

<Progress value={value} className="w-full max-w-sm" />`}
      >
        <AnimatedProgress />
      </Example>
    </ComponentPage>
  );
}
