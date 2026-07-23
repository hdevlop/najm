import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Mail } from "lucide-react";
import React from "react";

import {
  NCard,
  NCardAction,
  NCardFooter,
  NCardMedia,
} from "../src/components/Card/Card";
import { NCardInfo, NCardSection } from "../src/components/Card/SectionCard";

describe("NCard media layouts", () => {
  test("image media defaults to side on mobile and top on desktop", () => {
    const { container } = render(
      <NCard title="Ahmed & Fatima">
        <NCardMedia variant="image" size={104}>
          <img src="/family.jpg" alt="Family" />
        </NCardMedia>
        <NCardAction><span>Pending</span></NCardAction>
        <p>Five members</p>
        <NCardFooter><button type="button">Support</button></NCardFooter>
      </NCard>,
    );

    const root = container.querySelector('[data-slot="card"]');
    const media = container.querySelector('[data-slot="card-media"]') as HTMLElement;
    const body = container.querySelector('[data-slot="card-body"]');
    expect(root?.getAttribute("data-media-layout")).toBe("responsive-image");
    expect(root?.className).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(root?.className).toContain("sm:flex");
    expect(media.className).not.toContain("row-span-full");
    expect(media.style.getPropertyValue("--n-card-media-size")).toBe("104px");
    expect(body?.className).toContain("flex-col");
    expect(body?.className).toContain("sm:contents");
    expect(container.textContent).toContain("Pending");
    expect(container.textContent).toContain("Support");
  });

  test("avatar media keeps mobile content beside it and spans details on desktop", () => {
    const { container } = render(
      <NCard title="Abdelouahed Zitouni" description="Male">
        <NCardMedia variant="avatar" size="sm"><span>AZ</span></NCardMedia>
        <NCardSection>
          <NCardInfo icon={Mail} label="Email" value="az@example.com" />
        </NCardSection>
      </NCard>,
    );

    const root = container.querySelector('[data-slot="card"]');
    const content = container.querySelector('[data-slot="card-content"]');
    const body = container.querySelector('[data-slot="card-body"]');
    expect(root?.getAttribute("data-media-layout")).toBe("responsive-avatar");
    expect(content?.className).toContain("col-start-2");
    expect(content?.className).toContain("sm:col-span-full");
    expect(content?.className).not.toContain("sm:col-start-auto");
    expect(body?.className).toContain("sm:contents");
    expect(container.querySelector('[data-slot="card-info"]')).not.toBeNull();
  });

  test("hero media stays full width above content and accepts overlays", () => {
    const { container, getByText } = render(
      <NCard title="HYUNDAI Tucson">
        <NCardMedia variant="hero" aspect="4/3">
          <img src="/vehicle.jpg" alt="Vehicle" />
          <span>312 000 Dh</span>
        </NCardMedia>
        <p>2023 · Casablanca</p>
      </NCard>,
    );

    const root = container.querySelector('[data-slot="card"]');
    const media = container.querySelector('[data-slot="card-media"]');
    expect(root?.getAttribute("data-media-layout")).toBe("top");
    expect(media?.className).toContain("aspect-[4/3]");
    expect(getByText("312 000 Dh")).toBeTruthy();
  });

  test("placement can force side or header layouts", () => {
    const { container, rerender } = render(
      <NCard title="Side">
        <NCardMedia variant="image" placement="side">Image</NCardMedia>
        <p>Body</p>
      </NCard>,
    );
    expect(container.querySelector('[data-slot="card"]')?.getAttribute("data-media-layout")).toBe("side");

    rerender(
      <NCard title="Header">
        <NCardMedia variant="avatar" placement="header">Avatar</NCardMedia>
        <p>Body</p>
      </NCard>,
    );
    expect(container.querySelector('[data-slot="card"]')?.getAttribute("data-media-layout")).toBe("header");
  });

  test("embedded removes the duplicate card surface", () => {
    const { container } = render(<NCard embedded title="Embedded">Body</NCard>);
    const root = container.querySelector('[data-slot="card"]');
    expect(root?.getAttribute("data-embedded")).toBe("true");
    expect(root?.className).toContain("bg-transparent");
    expect(root?.className).toContain("shadow-none");
  });
});

describe("NCardSection and NCardInfo", () => {
  test("responsive density compacts now and restores comfortable spacing at sm", () => {
    const { container } = render(
      <NCardSection density="responsive" surface="responsive">
        <NCardInfo icon={Mail} label="Email" value="person@example.com" />
      </NCardSection>,
    );

    const section = container.querySelector('[data-slot="card-section"]');
    const info = container.querySelector('[data-slot="card-info"]');
    expect(section?.className).toContain("sm:bg-muted/50");
    expect(info?.className).toContain("text-xs");
    expect(info?.className).toContain("sm:text-sm");
  });
});
