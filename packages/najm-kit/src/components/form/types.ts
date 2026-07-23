import type { SubmitHandler, UseFormProps, UseFormReturn } from "react-hook-form";
import type { ZodTypeAny, TypeOf } from "zod";
import type { TextInputProps, NumberInputProps, PasswordInputProps, TextAreaInputProps, SelectInputProps, MultiSelectInputProps, RadioGroupInputProps, SwitchInputProps, CheckboxInputProps, CheckboxGroupInputProps, FileInputProps, DateInputProps, StarRatingInputProps, ColorArrayInputProps, TimeInputProps, ComboboxInputProps, ImageInputProps, EmojiInputProps, LangInputProps, PhoneInputProps, SliderInputProps } from "../inputs/types";
import type { FormSlotClassNames, FormVariant } from "./VariantContext";
import type { NIconSource } from "../Icon";

export type FormInputBackground = "card" | "background" | "secondary" | "muted" | "transparent";

interface BaseFormInputProps {
  name: string;
  formLabel?: string;
  formDescription?: string;
  required?: boolean;
  icon?: NIconSource;
  iconColor?: string;
  items?: any;
  disabled?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  className?: string;
  /** Semantic surface color for the input control. */
  background?: FormInputBackground;
  classNames?: FormSlotClassNames;
  onChange?: (value: any) => void;
}

type FormInputSpecificProps<T> = Omit<T, "value" | "onChange" | keyof BaseFormInputProps>;

type InputTypeMap = {
  text: FormInputSpecificProps<TextInputProps>;
  number: FormInputSpecificProps<NumberInputProps>;
  password: FormInputSpecificProps<PasswordInputProps>;
  textarea: FormInputSpecificProps<TextAreaInputProps>;
  select: FormInputSpecificProps<SelectInputProps>;
  combobox: FormInputSpecificProps<ComboboxInputProps>;
  multiselect: FormInputSpecificProps<MultiSelectInputProps>;
  radio: FormInputSpecificProps<RadioGroupInputProps>;
  switch: FormInputSpecificProps<SwitchInputProps>;
  checkbox: FormInputSpecificProps<CheckboxInputProps>;
  checkboxGroup: FormInputSpecificProps<CheckboxGroupInputProps>;
  file: FormInputSpecificProps<FileInputProps>;
  image: FormInputSpecificProps<ImageInputProps>;
  date: FormInputSpecificProps<DateInputProps>;
  starRating: FormInputSpecificProps<StarRatingInputProps>;
  colorArray: FormInputSpecificProps<ColorArrayInputProps>;
  emoji: FormInputSpecificProps<EmojiInputProps>;
  lang: FormInputSpecificProps<LangInputProps>;
  phone: FormInputSpecificProps<PhoneInputProps>;
  time: FormInputSpecificProps<TimeInputProps>;
  slider: FormInputSpecificProps<SliderInputProps>;
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
  bordered?: boolean;
  as?: "form" | "div";
  className?: string;
  id?: string;
  devTools?: {
    enabled?: boolean;
    fill?: () => Partial<TypeOf<T>>;
  };
  children: React.ReactNode;
};
