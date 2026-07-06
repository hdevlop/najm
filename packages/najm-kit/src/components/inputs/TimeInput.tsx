import React, { useState, useEffect } from "react";
import { Input } from "../ui/input";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import { Clock } from "lucide-react";
import type { TimeInputProps } from "./types";

export const TimeInput: React.FC<TimeInputProps> = ({ value = "", onChange, placeholder = "", icon, showIcon = true, iconColor, className = "", variant = "default", status = "default", bordered, borderColor, format24 = true, showSeconds = false, disabled = false }) => {
  const [inputValue, setInputValue] = useState(value);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => { setInputValue(value); }, [value]);

  const formatTimeInput = (input: string): string => {
    const digits = input.replace(/\D/g, "");
    if (!digits) return "";
    let formatted = digits.slice(0, 2);
    if (digits.length >= 3) formatted += ":" + digits.slice(2, 4);
    if (showSeconds && digits.length >= 5) formatted += ":" + digits.slice(4, 6);
    return formatted;
  };

  const validateTime = (timeString: string): boolean => {
    if (!timeString) return true;
    const pattern = showSeconds ? /^([01]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/ : /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return pattern.test(timeString);
  };

  const handleInputChange = (newValue: string) => {
    if (newValue.length < inputValue.length) { setInputValue(newValue); onChange(newValue); return; }
    const formatted = formatTimeInput(newValue);
    const maxLength = showSeconds ? 8 : 5;
    if (formatted.length <= maxLength) {
      setInputValue(formatted);
      const valid = validateTime(formatted);
      setIsValid(valid);
      if (valid || formatted === "") onChange(formatted);
    }
  };

  const handleBlur = () => {
    if (inputValue) {
      let completed = inputValue;
      if (completed.length === 1) completed = "0" + completed + ":00";
      else if (completed.length === 3 && completed.includes(":")) completed += "00";
      else if (showSeconds && completed.length === 5) completed += ":00";
      if (validateTime(completed)) { setInputValue(completed); onChange(completed); }
    }
  };

  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  const currentStatus = !isValid ? "error" : status;

  return (
    <BaseInput variant={variant} status={currentStatus} bordered={bordered} borderColor={borderColor} className={cn("gap-2", className)}>
      {showIcon && (icon ? <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span> : <Clock className={iconProps.className} style={iconProps.style} />)}
      <Input type="text" placeholder={placeholder || (showSeconds ? "HH:MM:SS" : "HH:MM")} value={inputValue} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={(e) => { if (!/\d/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)) e.preventDefault(); }} onBlur={handleBlur} disabled={disabled} className={cn("p-0 border-0 shadow-none bg-transparent dark:bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground", !isValid ? "text-red-500" : "text-foreground")} />
    </BaseInput>
  );
};
