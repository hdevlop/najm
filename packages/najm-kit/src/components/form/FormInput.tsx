import React from "react";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { TextInput, NumberInput, PasswordInput, OtpInput, TextAreaInput, SelectInput, ComboboxInput, MultiSelectInput, RadioGroupInput, SwitchInput, CheckboxInput, CheckboxGroupInput, FileInput, ImageInput, AvatarInput, DateInput, StarRatingInput, ColorArrayInput, EmojiInput, LangInput, PhoneInput, TimeInput, TimeZoneInput, SliderInput } from "../inputs";
import { useFormContext } from "react-hook-form";
import { usePrefix } from "./PrefixContext";
import { useVariantPreset, useBordered } from "./VariantContext";
import { cn } from "../../lib/cn";
import { NIcon } from "../Icon";
import type { FormInputProps } from "./types";

const inputBackgroundClasses = {
  card: "!bg-card [&>div:first-child]:!bg-card",
  background: "!bg-background [&>div:first-child]:!bg-background",
  secondary: "!bg-secondary [&>div:first-child]:!bg-secondary",
  muted: "!bg-muted [&>div:first-child]:!bg-muted",
  transparent: "!bg-transparent [&>div:first-child]:!bg-transparent",
} as const;

const Inputs: Record<string, React.ComponentType<any>> = {
  switch: SwitchInput,
  checkbox: CheckboxInput,
  checkboxGroup: CheckboxGroupInput,
  text: TextInput,
  number: NumberInput,
  password: PasswordInput,
  otp: OtpInput,
  textarea: TextAreaInput,
  date: DateInput,
  file: FileInput,
  image: ImageInput,
  avatar: AvatarInput,
  select: SelectInput,
  combobox: ComboboxInput,
  multiselect: MultiSelectInput,
  radio: RadioGroupInput,
  starRating: StarRatingInput,
  colorArray: ColorArrayInput,
  emoji: EmojiInput,
  lang: LangInput,
  phone: PhoneInput,
  timeZone: TimeZoneInput,
  time: TimeInput,
  slider: SliderInput,
};

const nativeFieldTypes = new Set(["text", "number", "password", "textarea", "time"]);

// Composite inputs render their trigger as a `BaseInput` div, so the `<label for>`
// that FormControl wires up points at a non-labelable element and names nothing —
// the control reaches the accessibility tree anonymous. These types carry no other
// name source, so the form label becomes their `aria-label`. `select` is absent on
// purpose: SelectInput already resolves `ariaLabel || placeholder`, and renaming it
// from the label would break every consumer selecting it by placeholder today.
const labelNamedCompositeTypes = new Set(["date", "combobox", "multiselect"]);

export const FormInput: React.FC<FormInputProps> = ({ name, type, formLabel, formDescription, required = false, disabled = false, readOnly = false, hidden = false, icon, iconColor, classNames, background, ...rest }) => {
  const InputComponent = Inputs[type];
  const { control } = useFormContext();
  const { className, onChange: consumerOnChange, onBlur: consumerOnBlur, ...inputRest } = rest as any;
  const prefix = usePrefix();
  const preset = useVariantPreset();
  const contextBordered = useBordered();
  const fieldName = prefix ? `${prefix}.${name}` : name;

  if (!InputComponent) return null;

  const getDefaultValue = () => {
    if (type === "multiselect" || type === "checkboxGroup") return [];
    if (type === "switch" || type === "checkbox") return false;
    if (type === "starRating" || type === "emoji" || type === "slider") return 0;
    if (type === "image" || type === "avatar" || type === "file") return null;
    return "";
  };

  const presetInput = type === "textarea"
    ? preset.input?.replace(/\bh-\d+\b/g, "").trim()
    : preset.input;
  const isFillAvatar = type === "avatar" && inputRest.fill === true;
  const compositeAriaLabel = labelNamedCompositeTypes.has(type) && typeof formLabel === "string"
    ? { ariaLabel: inputRest.ariaLabel ?? formLabel }
    : {};
  const slot = {
    item: cn(
      preset.item,
      isFillAvatar && "flex h-full min-h-0 w-full flex-col",
      classNames?.item,
    ),
    label: cn(preset.label, classNames?.label),
    input: cn(presetInput, background && inputBackgroundClasses[background], classNames?.input, className),
    description: cn(preset.description, classNames?.description),
    error: cn(preset.error, classNames?.error),
  };

  return (
    <FormField control={control} name={fieldName} render={({ field, fieldState }) => {
      const hasError = !!fieldState.error;
      const isHidden = hidden || className?.includes("hidden");
      const handleChange = (val: any) => {
        field.onChange(val);
        consumerOnChange?.(val);
      };
      const nativeFieldBinding = nativeFieldTypes.has(type)
        ? {
            name: field.name,
            onBlur: (event: React.FocusEvent<HTMLElement>) => {
              field.onBlur();
              consumerOnBlur?.(event);
            },
            ref: field.ref,
          }
        : {};
      return (
        <FormItem className={slot.item}>
          {formLabel && (
            <FormLabel className={slot.label}>
              {icon && <NIcon icon={icon} size={16} className="shrink-0 text-muted-foreground" />}
              {formLabel}
              {required && !disabled && !readOnly && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <InputComponent value={field.value ?? getDefaultValue()} onChange={handleChange} status={hasError && !isHidden ? "error" : "default"} bordered={contextBordered} icon={formLabel ? undefined : icon} iconColor={formLabel ? undefined : iconColor} disabled={disabled} readOnly={readOnly} {...inputRest} {...compositeAriaLabel} {...nativeFieldBinding} className={slot.input} />
          </FormControl>
          {!hasError && !disabled && !readOnly && formDescription && <FormDescription className={slot.description}>{formDescription}</FormDescription>}
          {!isHidden && <FormMessage className={slot.error} />}
        </FormItem>
      );
    }} />
  );
};

export default FormInput;
