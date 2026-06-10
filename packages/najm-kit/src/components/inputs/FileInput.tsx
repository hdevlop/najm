import React, { useRef } from "react";
import { Label } from "../ui/label";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import { FileUp } from "lucide-react";
import type { FileInputProps } from "./types";

function truncateFilename(filename: string, maxLength = 25) {
  if (filename.length <= maxLength) return filename;
  const extIndex = filename.lastIndexOf(".");
  const ext = extIndex !== -1 ? filename.slice(extIndex) : "";
  const name = extIndex !== -1 ? filename.slice(0, extIndex) : filename;
  return `${name.slice(0, maxLength - ext.length - 3)}...${ext}`;
}

export const FileInput: React.FC<FileInputProps> = ({ value, onChange, placeholder = "No file chosen", icon, showIcon = true, iconColor, className = "", variant = "default", status = "default", bordered, borderDegree, borderColor }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");

  const displayFilename = () => {
    if (!value) return null;
    const filename = typeof value === "string" ? value.split(/[\\/]/).pop() || "" : (value as File).name;
    return truncateFilename(filename);
  };

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderDegree={borderDegree} borderColor={borderColor} className={cn("flex px-0 p-0 text-muted-foreground", className)} onClick={() => fileInputRef.current?.click()}>
      <input type="file" ref={fileInputRef} onChange={(e) => onChange(e.target.files?.[0] || null)} className="hidden" />
      <div className="bg-muted flex h-full items-center px-3">
        {showIcon && (icon ? <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span> : <FileUp className={cn(iconProps.className)} />)}
        <Label className="flex cursor-pointer h-full justify-center items-center px-2 text-muted-foreground">Choose File</Label>
      </div>
      <Label className="ml-2 flex-1">{displayFilename() || <span className="text-muted-foreground">{placeholder}</span>}</Label>
    </BaseInput>
  );
};
