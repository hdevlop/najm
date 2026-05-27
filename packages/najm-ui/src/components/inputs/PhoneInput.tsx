import React from "react";
import { PhoneInput as BasePhoneInput, defaultCountries } from "react-international-phone";
import { cn } from "../../lib/cn";
import { BaseInput } from "./BaseInput";
import type { PhoneInputProps } from "./types";

export function PhoneInput({
  value = "",
  onChange,
  defaultCountry = "us",
  placeholder = "Enter phone number",
  disabled = false,
  className,
  variant = "default",
  status = "default",
}: PhoneInputProps & { variant?: "default" | "rounded" | "ghost"; status?: "default" | "error" }) {
  return (
    <BaseInput variant={variant} status={status} className={cn("h-10 gap-0 p-0!", className)} disabled={disabled}>
      <BasePhoneInput
        defaultCountry={defaultCountry}
        value={value}
        onChange={onChange}
        countries={defaultCountries}
        disabled={disabled}
        placeholder={placeholder}
        inputStyle={{
          width: "100%",
          border: "none",
          background: "transparent",
          outline: "none",
          fontSize: "14px",
        }}
        countrySelectorStyleProps={{
          buttonStyle: {
            border: "none",
            background: "transparent",
          },
        }}
        style={{
          "--rip-border": "none",
          "--rip-bg": "transparent",
        } as React.CSSProperties}
      />
    </BaseInput>
  );
}
