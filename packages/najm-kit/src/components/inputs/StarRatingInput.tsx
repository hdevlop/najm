import React from "react";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { Star } from "lucide-react";
import type { StarRatingInputProps } from "./types";

export const StarRatingInput: React.FC<StarRatingInputProps> = ({ value, onChange, maxStars = 5, className = "", variant = "default", status = "default", bordered, borderDegree, borderColor }) => {
  const stars = Array.from({ length: maxStars }, (_, i) => (
    <Star key={i} onClick={() => onChange(i + 1)} className={cn("cursor-pointer h-8 w-8", i < value ? "fill-orange-400 text-orange-400" : "fill-[#d6d6d6] text-[#d6d6d6]")} />
  ));
  return <BaseInput variant={variant} status={status} bordered={bordered} borderDegree={borderDegree} borderColor={borderColor} className={cn("gap-2", className)}>{stars}</BaseInput>;
};
