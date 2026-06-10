import React from "react";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { TextInput, NumberInput, PasswordInput, TextAreaInput, SelectInput, ComboboxInput, MultiSelectInput, RadioGroupInput, SwitchInput, CheckboxInput, CheckboxGroupInput, FileInput, ImageInput, DateInput, StarRatingInput, ColorArrayInput, EmojiInput, LangInput, PhoneInput, TimeInput, SliderInput } from "../inputs";
import { useFormContext } from "react-hook-form";
import { usePrefix } from "./PrefixContext";
import { useVariantPreset, useBordered, useBorderDegree } from "./VariantContext";
import { cn } from "../../lib/cn";
import { NIcon } from "../Icon";
import type { FormInputProps } from "./types";

const Inputs: Record<string, React.ComponentType<any>> = {
  switch: SwitchInput,
  checkbox: CheckboxInput,
  checkboxGroup: CheckboxGroupInput,
  text: TextInput,
  number: NumberInput,
  password: PasswordInput,
  textarea: TextAreaInput,
  date: DateInput,
  file: FileInput,
  image: ImageInput,
  select: SelectInput,
  combobox: ComboboxInput,
  multiselect: MultiSelectInput,
  radio: RadioGroupInput,
  starRating: StarRatingInput,
  colorArray: ColorArrayInput,
  emoji: EmojiInput,
  lang: LangInput,
  phone: PhoneInput,
  time: TimeInput,
  slider: SliderInput,
};

export const FormInput: React.FC<FormInputProps> = ({ name, type, formLabel, formDescription, required = false, disabled = false, readOnly = false, hidden = false, icon, iconColor, classNames, ...rest }) => {
  const InputComponent = Inputs[type];
  const { control } = useFormContext();
  const { className, onChange: consumerOnChange, ...inputRest } = rest as any;
  const prefix = usePrefix();
  const preset = useVariantPreset();
  const contextBordered = useBordered();
  const contextBorderDegree = useBorderDegree();
  const fieldName = prefix ? `${prefix}.${name}` : name;

  if (!InputComponent) return null;

  const getDefaultValue = () => {
    if (type === "multiselect" || type === "checkboxGroup") return [];
    if (type === "switch" || type === "checkbox") return false;
    if (type === "starRating" || type === "emoji" || type === "slider") return 0;
    if (type === "image" || type === "file") return null;
    return "";
  };

  const presetInput = type === "textarea"
    ? preset.input?.replace(/\bh-\d+\b/g, "").trim()
    : preset.input;
  const slot = {
    item: cn(preset.item, classNames?.item),
    label: cn(preset.label, classNames?.label),
    input: cn(presetInput, classNames?.input, className),
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
            <InputComponent value={field.value ?? getDefaultValue()} onChange={handleChange} status={hasError && !isHidden ? "error" : "default"} bordered={contextBordered} borderDegree={contextBorderDegree} icon={formLabel ? undefined : icon} iconColor={formLabel ? undefined : iconColor} disabled={disabled} readOnly={readOnly} {...inputRest} className={slot.input} />
          </FormControl>
          {!hasError && !disabled && !readOnly && formDescription && <FormDescription className={slot.description}>{formDescription}</FormDescription>}
          {!isHidden && <FormMessage className={slot.error} />}
        </FormItem>
      );
    }} />
  );
};

export default FormInput;
