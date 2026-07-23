import React from "react";
import { ComponentPage } from "../../ComponentPage";
import {
  VariantsExample,
  OutlineMultiColorExample,
  DashedExample,
  SizesExample,
  RoundedExample,
  IconsExample,
  IconButtonsExample,
  LoadingExample,
  AsyncClickExample,
  AsyncNoLockExample,
  FullWidthExample,
  AliasExample,
} from "./examples";

export function ButtonPage() {
  return (
    <ComponentPage
      title="Button"
      description="A shadcn-native action primitive with Najm-friendly variants, sizing, rounded presets, icons, and async loading built in."
      category="Actions"
    >
      <VariantsExample />
      <OutlineMultiColorExample />
      <DashedExample />
      <SizesExample />
      <RoundedExample />
      <IconsExample />
      <IconButtonsExample />
      <LoadingExample />
      <AsyncClickExample />
      <AsyncNoLockExample />
      <FullWidthExample />
      <AliasExample />
    </ComponentPage>
  );
}
