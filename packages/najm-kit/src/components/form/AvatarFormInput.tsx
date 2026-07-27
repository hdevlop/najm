import React from "react";
import { FormInput } from "./FormInput";
import type { FormInputProps } from "./types";

export type AvatarFormInputProps = Omit<
  Extract<FormInputProps, { type: "avatar" }>,
  "type"
>;

/** Form-bound avatar picker convenience wrapper. */
export function AvatarFormInput(props: AvatarFormInputProps) {
  return <FormInput {...props} type="avatar" />;
}

