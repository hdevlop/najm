import { describe, expect, test } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ComboboxInput } from "../src/components/inputs/ComboboxInput";

describe("ComboboxInput keyboard activation", () => {
  test.each(["Enter", " "])("opens the search popover with %s", async (key) => {
    const view = render(
      <ComboboxInput
        ariaLabel="Time zone"
        items={[{ label: "Africa/Casablanca", value: "Africa/Casablanca" }]}
        onChange={() => undefined}
        searchPlaceholder="Search time zones..."
        value="Africa/Casablanca"
      />,
    );

    const trigger = view.getByRole("combobox", { name: "Time zone" });
    trigger.focus();
    await act(async () => {
      fireEvent.keyDown(trigger, { key });
    });

    expect(view.getByPlaceholderText("Search time zones...")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  test("does not activate a disabled combobox", async () => {
    const view = render(
      <ComboboxInput
        ariaLabel="Time zone"
        disabled
        items={[{ label: "Africa/Casablanca", value: "Africa/Casablanca" }]}
        onChange={() => undefined}
        searchPlaceholder="Search time zones..."
        value="Africa/Casablanca"
      />,
    );

    const trigger = view.getByRole("combobox", { name: "Time zone" });
    await act(async () => {
      fireEvent.keyDown(trigger, { key: "Enter" });
    });

    expect(view.queryByPlaceholderText("Search time zones...")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  // A disabled combobox used to look exactly like an enabled one: same cursor,
  // same colours, and a focus ring when clicked, but nothing opened.
  test("shows that it is disabled and takes no focus", () => {
    const items = [{ label: "Africa/Casablanca", value: "Africa/Casablanca" }];
    const view = render(
      <>
        <ComboboxInput ariaLabel="Locked" disabled items={items} onChange={() => undefined} value="Africa/Casablanca" />
        <ComboboxInput ariaLabel="Open" items={items} onChange={() => undefined} value="Africa/Casablanca" />
      </>,
    );

    const locked = view.getByRole("combobox", { name: "Locked" });
    expect(locked.getAttribute("aria-disabled")).toBe("true");
    expect(locked.hasAttribute("tabindex")).toBe(false);
    expect(locked.className).toContain("cursor-not-allowed");
    expect(locked.className).toContain("opacity-50");
    expect(locked.className).not.toContain("cursor-pointer");

    const open = view.getByRole("combobox", { name: "Open" });
    expect(open.hasAttribute("aria-disabled")).toBe(false);
    expect(open.getAttribute("tabindex")).toBe("0");
    expect(open.className).toContain("cursor-pointer");
    expect(open.className).not.toContain("opacity-50");
  });

  test("selects a filtered option without a pointer", async () => {
    const user = userEvent.setup();

    function ControlledCombobox() {
      const [value, setValue] = React.useState("Africa/Casablanca");

      return (
        <ComboboxInput
          ariaLabel="Time zone"
          items={[
            { label: "Africa/Casablanca", value: "Africa/Casablanca" },
            { label: "Africa/Nairobi", value: "Africa/Nairobi" },
          ]}
          onChange={setValue}
          searchPlaceholder="Search time zones..."
          value={value}
        />
      );
    }

    const view = render(<ControlledCombobox />);
    const trigger = view.getByRole("combobox", { name: "Time zone" });

    trigger.focus();
    await user.keyboard("{Enter}");
    await user.type(
      view.getByPlaceholderText("Search time zones..."),
      "Africa{ArrowDown}",
    );
    await user.keyboard("{Enter}");

    expect(trigger.textContent).toContain("Africa/Nairobi");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
