import * as React from 'react';
import { cn } from "../../lib/cn";

export interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, className, disabled }: SliderProps) {
  const percentage = ((value[0] - min) / (max - min)) * 100;

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center h-5', className)}>
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-border">
        <div
          className="absolute h-full bg-brand rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div
        className="absolute h-5 w-5 rounded-full bg-brand border-2 border-bg shadow-md pointer-events-none transition-transform"
        style={{ left: `calc(${percentage}% - 10px)` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange([Number(e.target.value)])}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}