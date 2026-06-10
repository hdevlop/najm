import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip, NButton, IconButton } from 'najm-kit';
import { Info, Settings, HelpCircle } from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function TooltipPage() {
  return (
    <ComponentPage
      title="Tooltip"
      description="A popup that displays information related to an element when the element receives keyboard focus or mouse hover."
      category="Overlays"
    >
      <Example
        title="Basic tooltip"
        code={`import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from 'najm-kit';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <NButton variant="outline">Hover me</NButton>
    </TooltipTrigger>
    <TooltipContent>
      <p>This is a tooltip</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>`}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <NButton variant="outline">Hover me</NButton>
            </TooltipTrigger>
            <TooltipContent>
              <p>This is a tooltip</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Example>

      <Example
        title="Simple tooltip"
        description="A convenience wrapper for the most common tooltip pattern."
        code={`import { SimpleTooltip, IconButton } from 'najm-kit';
import { Settings, Info, HelpCircle } from 'lucide-react';

<SimpleTooltip content="Settings">
  <IconButton icon={<Settings size={16} />} variant="ghost" />
</SimpleTooltip>

<SimpleTooltip content="More information">
  <IconButton icon={<Info size={16} />} variant="ghost" />
</SimpleTooltip>

<SimpleTooltip content="Help">
  <IconButton icon={<HelpCircle size={16} />} variant="ghost" />
</SimpleTooltip>`}
      >
        <TooltipProvider>
          <SimpleTooltip content="Settings">
            <IconButton icon={<Settings size={16} />} variant="ghost" aria-label="Settings" />
          </SimpleTooltip>
          <SimpleTooltip content="More information">
            <IconButton icon={<Info size={16} />} variant="ghost" aria-label="Info" />
          </SimpleTooltip>
          <SimpleTooltip content="Help & documentation">
            <IconButton icon={<HelpCircle size={16} />} variant="ghost" aria-label="Help" />
          </SimpleTooltip>
        </TooltipProvider>
      </Example>

      <Example
        title="Tooltip positions"
        code={`<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><NButton variant="outline" size="sm">Top</NButton></TooltipTrigger>
    <TooltipContent side="top"><p>Tooltip on top</p></TooltipContent>
  </Tooltip>
  <Tooltip>
    <TooltipTrigger asChild><NButton variant="outline" size="sm">Bottom</NButton></TooltipTrigger>
    <TooltipContent side="bottom"><p>Tooltip on bottom</p></TooltipContent>
  </Tooltip>
  <Tooltip>
    <TooltipTrigger asChild><NButton variant="outline" size="sm">Left</NButton></TooltipTrigger>
    <TooltipContent side="left"><p>Tooltip on left</p></TooltipContent>
  </Tooltip>
  <Tooltip>
    <TooltipTrigger asChild><NButton variant="outline" size="sm">Right</NButton></TooltipTrigger>
    <TooltipContent side="right"><p>Tooltip on right</p></TooltipContent>
  </Tooltip>
</TooltipProvider>`}
      >
        <TooltipProvider>
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <Tooltip key={side}>
              <TooltipTrigger asChild>
                <NButton variant="outline" size="sm">{side.charAt(0).toUpperCase() + side.slice(1)}</NButton>
              </TooltipTrigger>
              <TooltipContent side={side}>
                <p>Tooltip on {side}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </Example>
    </ComponentPage>
  );
}
