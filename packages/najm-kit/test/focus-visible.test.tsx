import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  NumberInput,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  focusRingClasses,
  focusRingWithinClasses,
} from "../src/index";

// ============================================================================
// The focus-visible contract
//
// Every primitive a keyboard user can land on has to show that it has focus.
// The failure this locks down is not theoretical: `TabsContent` carried
// `outline-none` and nothing else while Radix gives it `tabIndex={0}`, so five
// panels on the theme settings page were silent tab stops — focus went in and
// the screen did not change. WCAG 2.4.7, found by tabbing through a production
// build rather than by any unit suite.
//
// These assert the rendered class list rather than a computed style, because
// happy-dom does not run Tailwind. That is the honest limit of this file: it
// proves the primitive asks for the ring. Proof that the ring actually paints
// belongs to the Playwright acceptance run, which reads `box-shadow` off a real
// Chromium and is where the original defect was caught.
// ============================================================================

/** The two halves of the token, so a partial application cannot pass. */
const RING = "focus-visible:ring-[3px]";
const RING_COLOR = "focus-visible:ring-ring/50";

function classesOf(element: Element | null): string {
  return element?.getAttribute("class") ?? "";
}

describe("the shared focus token", () => {
  test("suppresses the user-agent outline and draws a ring in its place", () => {
    // Suppressing the outline without replacing it is the exact defect. Pairing
    // them in one token is what stops a primitive from doing only the first
    // half, so the token itself is asserted before anything consumes it.
    expect(focusRingClasses).toContain("outline-none");
    expect(focusRingClasses).toContain(RING);
    expect(focusRingClasses).toContain(RING_COLOR);
  });

  test("colours the ring from the kit's theme token, not a fixed value", () => {
    // `ring-ring` resolves to `--ring`, which the design provider rewrites at
    // runtime. A hard-coded colour would survive a palette change and stop
    // meeting contrast the moment an application picked its own.
    expect(focusRingClasses).toContain("ring-ring");
    expect(focusRingClasses).not.toMatch(/#[0-9a-f]{3,8}|oklch\(|rgb\(/i);
  });

  test("is scoped to :focus-visible, so a mouse press leaves nothing behind", () => {
    const ringUtilities = focusRingClasses
      .split(/\s+/)
      .filter((utility) => /(^|:)ring-/.test(utility));

    expect(ringUtilities.length).toBeGreaterThan(0);
    for (const utility of ringUtilities) {
      expect(utility, `${utility} must be focus-visible only`).toStartWith("focus-visible:");
    }
  });
});

describe("composite inputs", () => {
  test("the wrapper carries the ring, because the inner control gives up its own", () => {
    // `NumberInput` clears the inner `<input>`'s ring on purpose — the border
    // belongs to the wrapper, and a ring drawn inside it looks like a mistake.
    // The wrapper therefore has to light up, for focus landing on itself (the
    // multi-select trigger) and for focus landing on a child (this).
    const { container } = render(<NumberInput value={1} onChange={() => {}} />);
    const wrapper = container.firstElementChild;

    expect(classesOf(wrapper)).toContain("has-[:focus-visible]:ring-[3px]");
    expect(classesOf(wrapper)).toContain(RING);
  });

  test("the within-token covers both the wrapper itself and a focused child", () => {
    expect(focusRingWithinClasses).toContain("focus-visible:ring-[3px]");
    expect(focusRingWithinClasses).toContain("has-[:focus-visible]:ring-[3px]");
    expect(focusRingWithinClasses).toContain("ring-ring");
    // `:focus-within` would also fire for a pointer click. This stays a
    // keyboard indicator, like every other use of the token.
    expect(focusRingWithinClasses).not.toContain("focus-within:");
  });
});

describe("tabs", () => {
  function mountTabs() {
    return render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">first panel</TabsContent>
      </Tabs>,
    );
  }

  test("a trigger shows a focus ring", () => {
    const { container } = mountTabs();
    const trigger = container.querySelector('[data-slot="tabs-trigger"]');

    expect(classesOf(trigger)).toContain(RING);
    expect(classesOf(trigger)).toContain(RING_COLOR);
  });

  test("a panel is a tab stop, and therefore shows a focus ring", () => {
    const { container } = mountTabs();
    const panel = container.querySelector('[data-slot="tabs-content"]');

    // The premise first: the ring is required *because* Radix makes the panel
    // focusable. If a future version stops doing that, this assertion fails and
    // whoever reads it learns the requirement changed rather than deleting a
    // rule they no longer understand.
    expect(panel?.getAttribute("tabindex"), "Radix makes the panel focusable").toBe("0");
    expect(classesOf(panel)).toContain(RING);
    expect(classesOf(panel)).toContain(RING_COLOR);
  });

  test("a caller's own classes are kept alongside the ring", () => {
    const { container } = render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one" className="mt-4">
            One
          </TabsTrigger>
        </TabsList>
        <TabsContent value="one" className="p-6">
          panel
        </TabsContent>
      </Tabs>,
    );

    expect(classesOf(container.querySelector('[data-slot="tabs-trigger"]'))).toContain("mt-4");
    const panel = classesOf(container.querySelector('[data-slot="tabs-content"]'));
    expect(panel).toContain("p-6");
    expect(panel).toContain(RING);
  });
});

describe("collapsible", () => {
  test("a trigger shows a focus ring without the caller asking for one", () => {
    const { container } = render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Section</CollapsibleTrigger>
        <CollapsibleContent>body</CollapsibleContent>
      </Collapsible>,
    );
    const trigger = container.querySelector('[data-slot="collapsible-trigger"]');

    expect(classesOf(trigger)).toContain(RING);
    expect(classesOf(trigger)).toContain(RING_COLOR);
  });

  test("a caller's own classes are kept alongside the ring", () => {
    const { container } = render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="w-full text-left">Section</CollapsibleTrigger>
        <CollapsibleContent>body</CollapsibleContent>
      </Collapsible>,
    );
    const trigger = classesOf(container.querySelector('[data-slot="collapsible-trigger"]'));

    expect(trigger).toContain("w-full");
    expect(trigger).toContain(RING);
  });

  test("the ring survives asChild, where the trigger renders as someone else's button", () => {
    // The customizer's section headers use this form. A ring applied only when
    // the primitive renders its own element would miss every one of them.
    const { container } = render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <button type="button" className="px-3">
            Section
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>body</CollapsibleContent>
      </Collapsible>,
    );
    const trigger = classesOf(container.querySelector('[data-slot="collapsible-trigger"]'));

    expect(trigger).toContain("px-3");
    expect(trigger).toContain(RING);
  });
});
