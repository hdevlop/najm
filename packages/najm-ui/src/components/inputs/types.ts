import type { ComponentType } from "react";

interface BaseProps {
  className?: string;
  variant?: "default" | "rounded" | "ghost";
  status?: "default" | "error";
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
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
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
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
  showIcon?: boolean;
}

export interface PasswordInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
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
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
  showIcon?: boolean;
  disabled?: boolean;
}

export interface ComboboxInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  items: (string | SelectItemType)[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
  showIcon?: boolean;
  disabled?: boolean;
  allowFreeText?: boolean;
}

export interface MultiSelectInputProps extends BaseProps {
  value: string[];
  onChange: (value: string[]) => void;
  items: (string | SelectItemType)[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
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
  icon?: string | ComponentType<{ className?: string }>;
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
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
  showIcon?: boolean;
}

export interface DateInputProps extends BaseProps {
  value: Date | undefined;
  onChange: (date: string | undefined) => void;
  placeholder?: string;
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
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

export interface TimeInputProps extends BaseProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
  showIcon?: boolean;
  format24?: boolean;
  showSeconds?: boolean;
  disabled?: boolean;
}

export interface ImageInputProps extends BaseProps {
  value: File | string | null;
  onChange: (file: File | null) => void;
  placeholder?: string;
  icon?: string | ComponentType<{ className?: string; style?: React.CSSProperties }>;
  showIcon?: boolean;
  previewClassName?: string;
  showPreview?: boolean;
  previewPosition?: "top" | "bottom" | "left" | "right";
  allowClear?: boolean;
  accept?: string;
  defaultImage?: string;
  imageSize?: "sm" | "md" | "lg" | "xl";
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
