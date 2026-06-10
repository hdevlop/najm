import { describe, expect, test } from "bun:test";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { Save } from "lucide-react";
import { Button, NButton, buttonVariants } from "../src/components/Button";
import { Button as LegacyButton } from "../src/components/ui/button";
import { NIcon } from "../src/components/Icon";
import { NIcon as LegacyNIcon } from "../src/components/ui/nicon/NIcon";

describe("Button", () => {
  test("keeps Button and NButton aliases aligned", () => {
    expect(Button).toBe(NButton);
    expect(LegacyButton).toBe(Button);
  });

  test("applies expanded variant, size, rounded, and width classes", () => {
    const { container } = render(
      <Button variant="success" size="2xl" rounded="full" fullWidth>
        Save
      </Button>
    );
    const button = container.querySelector("button")!;

    expect(button.className).toContain("bg-emerald-600");
    expect(button.className).toContain("h-14");
    expect(button.className).toContain("rounded-full");
    expect(button.className).toContain("w-full");
  });

  test("buttonVariants exposes the new rounded option", () => {
    expect(buttonVariants({ rounded: "2xl" })).toContain("rounded-2xl");
  });

  test("renders controlled loading state with replacement text", () => {
    const { container } = render(
      <Button loading loadingText="Saving">
        Save
      </Button>
    );
    const button = container.querySelector("button")!;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(container.textContent).toContain("Saving");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("accepts string and component icon sources", () => {
    const { container } = render(
      <>
        <Button leftIcon="save">Save</Button>
        <Button rightIcon={Save}>Export</Button>
      </>
    );

    expect(container.querySelectorAll("svg").length).toBe(2);
  });

  test("accepts rendered element icon sources", () => {
    const { container } = render(
      <Button leftIcon={<Save data-testid="save-icon" />}>Save</Button>
    );

    expect(container.querySelector("[data-testid='save-icon']")).toBeTruthy();
  });

  test("sets pending state while an async click is running", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const { container } = render(
      <Button onClick={() => pending} loadingText="Saving">
        Save
      </Button>
    );
    const button = container.querySelector("button")!;

    fireEvent.click(button);

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("data-loading")).toBe("true");
    expect(container.textContent).toContain("Saving");

    await act(async () => {
      finish();
      await pending;
    });

    await waitFor(() => {
      expect(button.disabled).toBe(false);
      expect(button.getAttribute("data-loading")).toBeNull();
    });
  });

  test("can keep async buttons clickable while loading", () => {
    let calls = 0;
    const never = new Promise<void>(() => {});
    const { container } = render(
      <Button disabledWhileLoading={false} onClick={() => {
        calls += 1;
        return never;
      }}>
        Save
      </Button>
    );
    const button = container.querySelector("button")!;

    fireEvent.click(button);
    fireEvent.click(button);

    expect(button.disabled).toBe(false);
    expect(calls).toBe(2);
  });
});

describe("NIcon", () => {
  test("keeps the legacy ui/nicon path aligned", () => {
    expect(LegacyNIcon).toBe(NIcon);
  });

  test("resolves lucide icons from strings", () => {
    const { container } = render(<NIcon icon="arrow-right" />);

    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("renders image sources from strings", () => {
    const { container } = render(<NIcon icon="/brand.svg" alt="Brand" />);
    const img = container.querySelector("img")!;

    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("/brand.svg");
    expect(img.getAttribute("alt")).toBe("Brand");
  });

  test("renders image source objects", () => {
    const { container } = render(<NIcon icon={{ src: "/logo.png", alt: "Logo" }} />);
    const img = container.querySelector("img")!;

    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("/logo.png");
    expect(img.getAttribute("alt")).toBe("Logo");
  });
});
