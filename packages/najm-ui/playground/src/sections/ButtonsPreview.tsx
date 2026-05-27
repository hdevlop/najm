import React from "react";
import { Button } from "najm-ui";

export default function ButtonsPreview() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Buttons</h2>
      <div className="flex flex-wrap gap-3">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
      <h3 className="text-md font-medium mt-4">Sizes</h3>
      <div className="flex flex-wrap gap-3 items-center">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon">+</Button>
      </div>
    </div>
  );
}
