import { describe, expect, test } from "bun:test";
import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react";
import { z } from "zod";
import { NForm } from "../../src/components/form/NForm";
import { FormInput } from "../../src/components/form/FormInput";
import { OtpInput } from "../../src/components/inputs/OtpInput";

function ControlledOtp({ onComplete }: { onComplete?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} ariaLabel="Verification code" />;
}

describe("OtpInput", () => {
  test("accepts typing, full-code paste, navigation, and deletion", () => {
    const completed: string[] = [];
    const { getAllByRole } = render(<ControlledOtp onComplete={(value) => completed.push(value)} />);
    const cells = getAllByRole("textbox") as HTMLInputElement[];

    fireEvent.change(cells[0], { target: { value: "1" } });
    fireEvent.change(cells[1], { target: { value: "2" } });
    expect(cells[0].value).toBe("1");
    expect(cells[1].value).toBe("2");

    fireEvent.paste(cells[1], { clipboardData: { getData: () => "654321" } });
    expect(cells.map((cell) => cell.value).join("")).toBe("654321");
    expect(completed).toEqual(["654321"]);

    cells[5].focus();
    fireEvent.keyDown(cells[5], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cells[4]);
    fireEvent.keyDown(cells[4], { key: "Backspace" });
    expect(cells.map((cell) => cell.value).join("")).toBe("65431");
  });

  test("filters non-digits and exposes accessible invalid state", () => {
    function InvalidOtp() {
      const [value, setValue] = useState("");
      return <OtpInput value={value} onChange={setValue} status="error" ariaLabel="Email code" />;
    }
    const { container, getAllByRole, getByRole } = render(
      <InvalidOtp />,
    );
    const cells = getAllByRole("textbox") as HTMLInputElement[];

    fireEvent.paste(cells[0], { clipboardData: { getData: () => "a1b2" } });
    expect(cells.map((cell) => cell.value).join("")).toBe("12");
    expect(getByRole("group").getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelectorAll('[autocomplete="one-time-code"]')).toHaveLength(1);
  });

  test("integrates with NForm as the otp field type", () => {
    const schema = z.object({ code: z.string().length(6) });
    const { container } = render(
      <NForm schema={schema} defaultValues={{ code: "123456" }} onSubmit={() => {}}>
        <FormInput name="code" type="otp" formLabel="Code" length={6} />
      </NForm>,
    );

    expect(container.querySelector('[data-slot="otp-input"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="otp-cell"]')).toHaveLength(6);
  });
});
