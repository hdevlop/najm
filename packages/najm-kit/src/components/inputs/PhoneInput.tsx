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
  borderDegree,
  borderColor,
}: PhoneInputProps & { variant?: "default" | "rounded" | "ghost"; status?: "default" | "error"; borderColor?: import("./types").TailwindColor; bordered?: boolean; borderDegree?: import("../../theme/types").NajmBorderDegree }) {
  const phoneThemeVars = {
    "--react-international-phone-height": "40px",
    "--react-international-phone-border-radius": "0",
    "--react-international-phone-background-color": "transparent",
    "--react-international-phone-text-color": "hsl(var(--najm-foreground))",
    "--react-international-phone-border-color": "transparent",
    "--react-international-phone-country-selector-background-color": "transparent",
    "--react-international-phone-country-selector-background-color-hover": "hsl(var(--najm-accent))",
    "--react-international-phone-country-selector-arrow-color": "hsl(var(--najm-muted-foreground))",
    "--react-international-phone-disabled-background-color": "transparent",
    "--react-international-phone-disabled-text-color": "hsl(var(--najm-muted-foreground))",
    "--react-international-phone-dropdown-top": "calc(100% + 6px)",
    "--react-international-phone-dropdown-left": "0",
    "--react-international-phone-dropdown-item-background-color": "hsl(var(--najm-popover))",
    "--react-international-phone-dropdown-item-text-color": "hsl(var(--najm-popover-foreground))",
    "--react-international-phone-dropdown-item-dial-code-color": "hsl(var(--najm-muted-foreground))",
    "--react-international-phone-selected-dropdown-item-background-color": "hsl(var(--najm-accent))",
    "--react-international-phone-selected-dropdown-item-text-color": "hsl(var(--najm-accent-foreground))",
    "--react-international-phone-selected-dropdown-item-dial-code-color": "hsl(var(--najm-muted-foreground))",
    "--react-international-phone-dropdown-preferred-list-divider-color": "hsl(var(--najm-border))",
    "--react-international-phone-dropdown-shadow": "0 16px 40px hsl(var(--najm-background) / 0.45)",
  } as React.CSSProperties;

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderDegree={borderDegree} borderColor={borderColor} className={cn("gap-0 overflow-visible p-0!", className)} disabled={disabled}>
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
          color: "hsl(var(--najm-foreground))",
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
              backgroundColor: "hsl(var(--najm-popover))",
              border: "1px solid hsl(var(--najm-border))",
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
