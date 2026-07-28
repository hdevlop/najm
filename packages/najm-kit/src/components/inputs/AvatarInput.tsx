import React from "react";
import { Camera } from "lucide-react";
import { cn } from "../../lib/cn";
import { ImageInput } from "./ImageInput";
import type { AvatarInputProps } from "./types";

const AVATAR_SIZE_MAP = {
  sm: "size-16",
  md: "size-24",
  lg: "size-32",
  xl: "size-40",
} as const;

const AVATAR_RADIUS_MAP = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
} as const;

/** A circular image picker preset for profile photos and user avatars. */
export function AvatarInput({
  imageSize = "md",
  size,
  fill = false,
  radius = "full",
  containerClassName,
  previewClassName,
  previewStyle,
  contentClassName,
  uploadIcon,
  title = "Upload photo",
  subtitleClassName,
  trigger = "icon",
  ...props
}: AvatarInputProps) {
  return (
    <ImageInput
      {...props}
      imageSize={imageSize}
      containerClassName={cn(
        fill && "min-h-24 w-full flex-1",
        containerClassName,
      )}
      previewClassName={cn(
        fill ? "size-full min-h-0" : AVATAR_SIZE_MAP[imageSize],
        "shrink-0",
        AVATAR_RADIUS_MAP[radius],
        previewClassName,
      )}
      previewStyle={{
        ...previewStyle,
        ...(size != null && !fill ? { width: size, height: size } : null),
      }}
      contentClassName={cn("gap-1 p-2", contentClassName)}
      uploadIcon={uploadIcon ?? <Camera className="size-6" />}
      title={title}
      subtitleClassName={cn("text-[10px] leading-tight", subtitleClassName)}
      trigger={trigger}
    />
  );
}
