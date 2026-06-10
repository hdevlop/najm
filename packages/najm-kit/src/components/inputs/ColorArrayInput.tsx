import React, { useState } from "react";
import { Check } from "lucide-react";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import type { ColorArrayInputProps } from "./types";

const DEFAULT_COLORS = ["#222222", "#e11d48", "#ea580c", "#16a34a", "#db2777", "#2563eb", "#9333ea", "#eab308"];

export const ColorArrayInput: React.FC<ColorArrayInputProps> = ({ value, onChange, className = "", variant = "default", status = "default", bordered, borderDegree, borderColor, colors = DEFAULT_COLORS }) => {
  const [selectedColor, setSelectedColor] = useState<string>(value || "");

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderDegree={borderDegree} borderColor={borderColor} className={cn("flex flex-wrap gap-2", className)}>
      {colors.map((color) => (
        <div key={color} className={cn("flex h-9 w-9 items-center justify-center cursor-pointer rounded-full transition-transform hover:scale-105", selectedColor === color && "ring-2 ring-offset-2")} onClick={() => { setSelectedColor(color); onChange(color); }}>
          <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
            {selectedColor === color && <Check className="h-4 w-4 text-white" />}
          </div>
        </div>
      ))}
    </BaseInput>
  );
};
