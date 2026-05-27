import type { SubmitHandler, UseFormProps, UseFormReturn } from "react-hook-form";
import type { ZodTypeAny, TypeOf } from "zod";
import type { TextInputProps, NumberInputProps, PasswordInputProps, TextAreaInputProps, SelectInputProps, MultiSelectInputProps, RadioGroupInputProps, SwitchInputProps, CheckboxInputProps, CheckboxGroupInputProps, FileInputProps, DateInputProps, StarRatingInputProps, ColorArrayInputProps, TimeInputProps, ComboboxInputProps, ImageInputProps, EmojiInputProps, LangInputProps, PhoneInputProps } from "../inputs/types";
import type { FormSlotClassNames, FormVariant } from "./VariantContext";

interface BaseFormInputProps {
  name: string;
  formLabel?: string;
  formDescription?: string;
  required?: boolean;
  icon?: React.ReactNode;
  iconColor?: string;
  items?: any;
  disabled?: boolean;
  hidden?: boolean;
  className?: string;
  classNames?: FormSlotClassNames;
  onChange?: (value: any) => void;
}

type InputTypeMap = {
  text: Omit<TextInputProps, "value" | "onChange">;
  number: Omit<NumberInputProps, "value" | "onChange">;
  password: Omit<PasswordInputProps, "value" | "onChange">;
  textarea: Omit<TextAreaInputProps, "value" | "onChange">;
  select: Omit<SelectInputProps, "value" | "onChange">;
  combobox: Omit<ComboboxInputProps, "value" | "onChange">;
  multiselect: Omit<MultiSelectInputProps, "value" | "onChange">;
  radio: Omit<RadioGroupInputProps, "value" | "onChange">;
  switch: Omit<SwitchInputProps, "value" | "onChange">;
  checkbox: Omit<CheckboxInputProps, "value" | "onChange">;
  checkboxGroup: Omit<CheckboxGroupInputProps, "value" | "onChange">;
  file: Omit<FileInputProps, "value" | "onChange">;
  image: Omit<ImageInputProps, "value" | "onChange">;
  date: Omit<DateInputProps, "value" | "onChange">;
  starRating: Omit<StarRatingInputProps, "value" | "onChange">;
  colorArray: Omit<ColorArrayInputProps, "value" | "onChange">;
  emoji: Omit<EmojiInputProps, "value" | "onChange">;
  lang: Omit<LangInputProps, "value" | "onChange">;
  phone: Omit<PhoneInputProps, "value" | "onChange">;
  time: Omit<TimeInputProps, "value" | "onChange">;
};

export type FormInputProps = {
  [K in keyof InputTypeMap]: BaseFormInputProps & { type: K } & InputTypeMap[K];
}[keyof InputTypeMap];

export type FormProps<T extends ZodTypeAny = ZodTypeAny> = {
  schema?: T;
  defaultValues?: UseFormProps<TypeOf<T>>["defaultValues"];
  onSubmit: SubmitHandler<TypeOf<T>>;
  form?: UseFormReturn<TypeOf<T>>;
  variant?: FormVariant;
  as?: "form" | "div";
  className?: string;
  id?: string;
  devTools?: {
    enabled?: boolean;
    fill?: () => Partial<TypeOf<T>>;
  };
  children: React.ReactNode;
};
