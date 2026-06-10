import React from "react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { Label } from "../ui/label";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps } from "./utils";
import type { DateInputProps } from "./types";

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, placeholder = "Pick a date", className = "", icon, showIcon = true, iconColor, variant = "default", status = "default", bordered, borderDegree, borderColor }) => {
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  const toDateString = (date: Date | undefined) => date?.toISOString().split("T")[0];

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderDegree={borderDegree} borderColor={borderColor} className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <div className={cn("w-full flex items-center cursor-pointer gap-2 justify-start text-left font-normal", !value && "text-foreground")}>
            <Label className="text-muted-foreground cursor-pointer">
              {value ? format(typeof value === "string" ? new Date(value) : value, "PPP") : placeholder}
            </Label>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={typeof value === "string" ? new Date(value) : value} onSelect={(date) => onChange(toDateString(date))} captionLayout="dropdown" />
        </PopoverContent>
      </Popover>
      {!icon && showIcon && <CalendarIcon className={iconProps.className} style={iconProps.style} />}
    </BaseInput>
  );
};
