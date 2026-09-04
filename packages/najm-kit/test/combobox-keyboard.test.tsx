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
