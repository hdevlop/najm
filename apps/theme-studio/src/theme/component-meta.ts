import type { NajmComponentName } from "najm-kit";

export interface ComponentControls {
  card?: boolean;
  radius?: boolean;
  density?: boolean;
  borderWidth?: boolean;
  defaultVariant?: string[];
  defaultSize?: string[];
  /** Variant names that can be aliased to another variant. */
  variantAlias?: string[];
  slots?: string[];
}

export interface ComponentMeta {
  name: NajmComponentName;
  label: string;
  controls: ComponentControls;
}

export interface ComponentCategory {
  id: string;
  label: string;
  components: NajmComponentName[];
}

export const COMPONENT_META: Record<NajmComponentName, ComponentMeta> = {
  button: {
    name: "button",
    label: "Button",
    controls: {
      radius: true,
      density: true,
      defaultVariant: ["default", "secondary", "tertiary", "outline", "ghost", "destructive", "soft", "subtle"],
      defaultSize: ["xs", "sm", "default", "lg", "xl"],
      variantAlias: ["default", "secondary", "tertiary", "outline", "ghost"],
    },
  },
  badge: {
    name: "badge",
    label: "Badge",
    controls: {
      radius: true,
      defaultVariant: ["default", "secondary", "destructive", "success", "warning", "outline"],
      variantAlias: ["default", "secondary", "destructive", "success", "warning", "outline"],
    },
  },
  card: {
    name: "card",
    label: "Card",
    controls: { radius: true, borderWidth: true },
  },
  table: {
    name: "table",
    label: "Table",
    controls: { radius: true, density: true, slots: ["header", "row"] },
  },
  tabs: {
    name: "tabs",
    label: "Tabs",
    controls: { radius: true, density: true },
  },
  dialog: {
    name: "dialog",
    label: "Dialog",
    controls: { radius: true, borderWidth: true },
  },
  alert: {
    name: "alert",
    label: "Alert",
    controls: { radius: true, borderWidth: true },
  },
  sidebar: {
    name: "sidebar",
    label: "Sidebar",
    controls: { borderWidth: true },
  },
  pageHeader: {
    name: "pageHeader",
    label: "Page Header",
    controls: { card: true, radius: true, borderWidth: true },
  },
  input: {
    name: "input",
    label: "Input",
    controls: { radius: true, borderWidth: true },
  },
  select: {
    name: "select",
    label: "Select",
    controls: { radius: true, borderWidth: true },
  },
  sheet: {
    name: "sheet",
    label: "Sheet",
    controls: { borderWidth: true },
  },
  popover: {
    name: "popover",
    label: "Popover",
    controls: { radius: true, borderWidth: true },
  },
  tooltip: {
    name: "tooltip",
    label: "Tooltip",
    controls: { radius: true },
  },
  progress: {
    name: "progress",
    label: "Progress",
    controls: { radius: true },
  },
  avatar: {
    name: "avatar",
    label: "Avatar",
    controls: { radius: true },
  },
};

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  { id: "actions", label: "Actions", components: ["button", "badge", "alert"] },
  { id: "surfaces", label: "Surfaces", components: ["card", "dialog", "sheet", "popover", "tooltip"] },
  { id: "navigation", label: "Navigation", components: ["sidebar", "pageHeader", "tabs"] },
  { id: "data", label: "Data", components: ["table", "progress", "avatar"] },
  { id: "inputs", label: "Inputs", components: ["input", "select"] },
];

export const RADIUS_OPTIONS = [
  "inherit",
  "none",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "full",
] as const;

export const DENSITY_OPTIONS = ["compact", "default", "comfortable"] as const;
