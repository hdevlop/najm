import type { ComponentType, CSSProperties, ReactNode } from "react";

export type InputIcon = string | ReactNode | ComponentType<{ className?: string; style?: CSSProperties }>;

const TAILWIND_COLORS = [
  "black", "white", "gray", "slate", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow",
  "green", "teal", "blue", "indigo", "purple",
] as const;

export type TailwindColor =
  | "muted" | "primary" | "accent" | "success" | "warning" | "destructive"
  | typeof TAILWIND_COLORS[number];

interface BaseProps {
  className?: string;
  variant?: "default" | "rounded" | "ghost";
  status?: "default" | "error";
  bordered?: boolean;
  borderColor?: TailwindColor;
  iconColor?: string;
}

export interface SelectItemType {
  value: string;
  label: string;
  icon?: string | ComponentType<{ className?: string }>;
}

export interface TextInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: InputIcon;
  showIcon?: boolean;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export interface NumberInputProps extends BaseProps {
  value: string | number;
  onChange: (value: number) => void;
  placeholder?: string;
  icon?: InputIcon;
  showIcon?: boolean;
}

export interface PasswordInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: InputIcon;
  showIcon?: boolean;
}

export interface TextAreaInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export interface SelectInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  items: (string | SelectItemType)[];
  placeholder?: string;
  ariaLabel?: string;
  icon?: InputIcon;
  showIcon?: boolean;
  disabled?: boolean;
  /** Class applied to the portalled dropdown surface. */
  dropdownClassName?: string;
}

export interface ComboboxInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  items: (string | SelectItemType)[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  icon?: InputIcon;
  showIcon?: boolean;
  disabled?: boolean;
  allowFreeText?: boolean;
}

export interface MultiSelectInputProps extends BaseProps {
  value: string[];
  onChange: (value: string[]) => void;
  items: (string | SelectItemType)[];
  ariaLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  icon?: InputIcon;
  showIcon?: boolean;
  disabled?: boolean;
  maxDisplay?: number;
  showSearch?: boolean;
}

export interface RadioGroupInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  items: (string | SelectItemType)[];
  layout?: "row" | "column";
}

export interface SwitchInputProps extends BaseProps {
  value: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  helper?: string;
  icon?: InputIcon;
  showIcon?: boolean;
  iconPosition?: "label" | "input";
}

export interface CheckboxInputProps extends BaseProps {
  value: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  helper?: string;
  checkboxClassName?: string;
}

export interface CheckboxGroupInputProps extends BaseProps {
  value: string[];
  onChange: (newValue: string[]) => void;
  items: (string | SelectItemType)[];
  layout?: "row" | "column";
}

export interface FileInputProps extends BaseProps {
  value: File | string | null;
  onChange: (file: File | null) => void;
  placeholder?: string;
  icon?: InputIcon;
  showIcon?: boolean;
}

export interface DateInputProps extends BaseProps {
  value: Date | undefined;
  onChange: (date: string | undefined) => void;
  placeholder?: string;
  icon?: InputIcon;
  showIcon?: boolean;
}

export interface StarRatingInputProps extends BaseProps {
  value: number;
  onChange: (starNumber: number | undefined) => void;
  maxStars?: number;
}

export interface ColorArrayInputProps extends BaseProps {
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
}

export interface ColorPickerInputProps extends ColorArrayInputProps {
  disabled?: boolean;
  /** `"swatches"` keeps the legacy inline UI. `"popover"` opens a tweakcn-style picker. */
  mode?: "popover" | "swatches";
  /** Which format tabs the popover exposes. */
  formats?: import("./color/convert").ColorFormat[];
  /** How emitted values are formatted. `"preserve"` keeps the input's own format. */
  output?: import("./color/convert").ColorFormat | "preserve";
  hideSwatches?: boolean;
}

export interface TimeInputProps extends BaseProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: InputIcon;
  showIcon?: boolean;
  format24?: boolean;
  showSeconds?: boolean;
  disabled?: boolean;
}

export interface TimeZoneInputProps extends Omit<ComboboxInputProps, "items"> {
  items?: SelectItemType[];
}

export interface ImageInputProps extends BaseProps {
  value: File | string | null;
  onChange: (file: File | null) => void;
  placeholder?: string;
  icon?: InputIcon;
  showIcon?: boolean;
  uploadIcon?: React.ReactNode;
  /** Class applied to the component's outer layout container. */
  containerClassName?: string;
  previewClassName?: string;
  /** Inline styles applied to the preview container. */
  previewStyle?: CSSProperties;
  /** Class applied to the empty and replace-overlay content inside the preview. */
  contentClassName?: string;
  showPreview?: boolean;
  previewPosition?: "top" | "bottom" | "left" | "right";
  allowClear?: boolean;
  accept?: string;
  defaultImage?: string;
  imageSize?: "sm" | "md" | "lg" | "xl";
  imageVersion?: string | number | null;
  title?: string;
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  replaceTitle?: string;
  replaceSubtitle?: string;
  trigger?: "icon" | "button" | "both";
  buttonLabel?: string;
  disabled?: boolean;
}

export interface OtpInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  /** Number of one-character cells. */
  length?: number;
  /** Restrict the code to decimal digits. */
  numeric?: boolean;
  ariaLabel?: string;
  digitAriaLabel?: (position: number, length: number) => string;
  autoFocus?: boolean;
  autoComplete?: React.HTMLInputAutoCompleteAttribute;
  disabled?: boolean;
  readOnly?: boolean;
  inputClassName?: string;
  onComplete?: (value: string) => void;
}

export type AvatarInputRadius = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

/** ImageInput options with avatar-specific radius defaults. */
export interface AvatarInputProps extends ImageInputProps {
  /** Preview corner radius. `none` is square and `full` is circular. */
  radius?: AvatarInputRadius;
  /** Exact width and height. Numbers are interpreted as pixels. */
  size?: number | string;
  /** Fill the available width and remaining height of the form item. */
  fill?: boolean;
}

export interface EmojiInputProps extends BaseProps {
  value: number;
  onChange: (value: number) => void;
  options?: { value: number; label: string }[];
}

export interface PhoneInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  disabled?: boolean;
}

export interface LangInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string; icon?: string | ComponentType<{ className?: string }> }[];
  placeholder?: string;
  disabled?: boolean;
}

export type { SliderInputProps } from "./SliderInput";
