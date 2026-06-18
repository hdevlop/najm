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
  bordered,
  borderColor,
}: PhoneInputProps & { variant?: "default" | "rounded" | "ghost"; status?: "default" | "error"; borderColor?: import("./types").TailwindColor; bordered?: boolean }) {
  const phoneThemeVars = {
    "--react-international-phone-height": "40px",
    "--react-international-phone-border-radius": "0",
    "--react-international-phone-background-color": "transparent",
    "--react-international-phone-text-color": "var(--foreground)",
    "--react-international-phone-border-color": "transparent",
    "--react-international-phone-country-selector-background-color": "transparent",
    "--react-international-phone-country-selector-background-color-hover": "var(--accent)",
    "--react-international-phone-country-selector-arrow-color": "var(--muted-foreground)",
    "--react-international-phone-disabled-background-color": "transparent",
    "--react-international-phone-disabled-text-color": "var(--muted-foreground)",
    "--react-international-phone-dropdown-top": "calc(100% + 6px)",
    "--react-international-phone-dropdown-left": "0",
    "--react-international-phone-dropdown-item-background-color": "var(--popover)",
    "--react-international-phone-dropdown-item-text-color": "var(--popover-foreground)",
    "--react-international-phone-dropdown-item-dial-code-color": "var(--muted-foreground)",
    "--react-international-phone-selected-dropdown-item-background-color": "var(--accent)",
    "--react-international-phone-selected-dropdown-item-text-color": "var(--accent-foreground)",
    "--react-international-phone-selected-dropdown-item-dial-code-color": "var(--muted-foreground)",
    "--react-international-phone-dropdown-preferred-list-divider-color": "var(--border)",
    "--react-international-phone-dropdown-shadow": "0 16px 40px color-mix(in oklch, var(--background), transparent 55%)",
  } as React.CSSProperties;

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={cn("gap-0 overflow-visible p-0!", className)} disabled={disabled}>
      <BasePhoneInput
        className="w-full"
        defaultCountry={defaultCountry}
        value={value}
        onChange={onChange}
        countries={defaultCountries}
        disabled={disabled}
        placeholder={placeholder}
        inputStyle={{
          height: "100%",
          width: "100%",
          border: "none",
          background: "transparent",
          outline: "none",
          fontSize: "14px",
          color: "var(--foreground)",
        }}
        countrySelectorStyleProps={{
          style: {
            height: "100%",
          },
          buttonStyle: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            border: "none",
            background: "transparent",
            paddingInline: "10px",
          },
          buttonContentWrapperStyle: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            lineHeight: 1,
          },
          flagStyle: {
            display: "block",
          },
          dropdownArrowStyle: {
            flexShrink: 0,
            marginTop: 0,
          },
          dropdownStyleProps: {
            style: {
              zIndex: 60,
              width: "min(300px, calc(100vw - 32px))",
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              overflowX: "hidden",
            },
          },
        }}
        style={phoneThemeVars}
      />
    </BaseInput>
  );
}
