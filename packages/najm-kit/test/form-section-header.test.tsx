import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { Megaphone } from "lucide-react";
import { NFormSectionHeader } from "../src/components/form";

describe("NFormSectionHeader", () => {
  test("uses the header foreground color for the icon and label", () => {
    const { container } = render(
      <NFormSectionHeader
        icon={Megaphone}
        title="Announcement Details"
        color="bg-primary text-primary-foreground"
      />
    );

    const icon = container.querySelector("svg")!;
    const label = container.querySelector('[data-slot="label"]')!;

    expect(icon.getAttribute("class")).toContain("text-current");
    expect(label.className).toContain("text-current");
  });
});
