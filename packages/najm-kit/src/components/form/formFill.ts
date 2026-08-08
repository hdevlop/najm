import type { TypeOf, ZodTypeAny } from "zod";

export type FormFillOverride =
  | unknown
  | readonly unknown[]
  | ((fieldName: string) => unknown);

export type FormFillOverrides = Record<string, FormFillOverride>;

export interface FormDevToolsOptions {
  enabled?: boolean;
  shortcut?: string;
}

export interface FormDevToolsConfig<T extends ZodTypeAny = ZodTypeAny>
  extends FormDevToolsOptions {
  fill?: () => Partial<TypeOf<T>>;
  overrides?: FormFillOverrides;
}

export type FormDevTools<T extends ZodTypeAny = ZodTypeAny> =
  | boolean
  | FormDevToolsConfig<T>;

type ZodLike = {
  _def?: Record<string, unknown>;
  def?: Record<string, unknown>;
  element?: unknown;
  options?: readonly unknown[];
  shape?: Record<string, unknown> | (() => Record<string, unknown>);
};

const CITIES = ["Casablanca", "Rabat", "Marrakesh", "Tangier"] as const;
const SCHOOL_LEVELS = ["Primary", "Middle school", "Secondary school"] as const;
const CLOTHING_SIZES = ["6 years", "8 years", "10 years", "12 years"] as const;

function pick<T>(values: readonly T[]): T | undefined {
  if (values.length === 0) return undefined;
  return values[Math.floor(Math.random() * values.length)];
}

function randomDigits(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function randomToken(length = 8) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function asZodLike(schema: unknown): ZodLike | undefined {
  return schema && typeof schema === "object" ? (schema as ZodLike) : undefined;
}

function definition(schema: unknown): Record<string, unknown> {
  const current = asZodLike(schema);
  return current?._def ?? current?.def ?? {};
}

function schemaKind(schema: unknown) {
  const currentDefinition = definition(schema);
  const raw = currentDefinition.typeName ?? currentDefinition.type;
  if (typeof raw !== "string") return "";
  return raw.replace(/^Zod/, "").toLowerCase();
}

function unwrap(schema: unknown): ZodLike | undefined {
  const seen = new Set<ZodLike>();
  let current = asZodLike(schema);

  while (current && !seen.has(current)) {
    seen.add(current);
    const kind = schemaKind(current);
    const currentDefinition = definition(current);
    const inner =
      currentDefinition.innerType ??
      currentDefinition.schema ??
      (kind === "pipe"
        ? currentDefinition.out ?? currentDefinition.in
        : undefined);

    if (!inner || typeof inner !== "object") break;
    current = inner as ZodLike;
  }

  return current;
}

function objectShape(schema: unknown): Record<string, unknown> | null {
  const current = unwrap(schema);
  if (schemaKind(current) !== "object") return null;
  const shape = current?.shape ?? definition(current).shape;
  return typeof shape === "function"
    ? shape()
    : ((shape ?? null) as Record<string, unknown> | null);
}

function arrayElement(schema: unknown) {
  const current = unwrap(schema);
  if (schemaKind(current) !== "array") return null;
  const currentDefinition = definition(current);
  const element = current?.element ?? currentDefinition.element ?? currentDefinition.type;
  return element && typeof element === "object" ? (element as ZodLike) : null;
}

function enumValues(schema: unknown): unknown[] {
  const current = unwrap(schema);
  const currentDefinition = definition(current);
  const kind = schemaKind(current);

  if (kind === "literal") {
    const values = currentDefinition.values;
    if (Array.isArray(values)) return values;
    return "value" in currentDefinition ? [currentDefinition.value] : [];
  }
  if (kind !== "enum" && kind !== "nativeenum") return [];

  const entries = currentDefinition.entries;
  if (entries && typeof entries === "object") return Object.values(entries);
  const values = currentDefinition.values;
  if (Array.isArray(values)) return values;
  return Array.isArray(current?.options) ? [...current.options] : [];
}

function stringFormat(schema: unknown) {
  const currentDefinition = definition(unwrap(schema));
  if (typeof currentDefinition.format === "string") return currentDefinition.format;
  const checks = Array.isArray(currentDefinition.checks)
    ? currentDefinition.checks
    : [];
  for (const check of checks) {
    if (!check || typeof check !== "object") continue;
    const value = check as Record<string, unknown>;
    const format = value.format ?? value.kind;
    if (typeof format === "string") return format;
  }
  return "";
}

function resolveOverride(override: FormFillOverride, fieldName: string) {
  if (typeof override === "function") return override(fieldName);
  if (Array.isArray(override)) {
    const value = pick(override);
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }
  return override;
}

function localDateInput(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function birthDate(child: boolean) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - (child ? 10 : 35));
  return localDateInput(date);
}

function fieldValue(
  fieldName: string,
  schema: unknown,
  siblingFields: ReadonlySet<string>,
): unknown {
  const key = fieldName.toLowerCase();
  const current = unwrap(schema);
  const kind = schemaKind(current);
  const format = stringFormat(current);
  const values = enumValues(current);

  if (values.length) return pick(values);
  if (kind === "boolean") return true;
  if (kind === "number" || kind === "bigint") {
    if (key.includes("sortorder")) return 1;
    if (key.includes("quantity")) return 5;
    return 10;
  }
  if (format === "uuid" || key.endsWith("uuid")) {
    return "9cc2c93f-f545-4e07-9f77-f79f08a71dd5";
  }
  if (format === "email" || key.includes("email")) {
    return `test-${randomToken()}@example.com`;
  }
  if (
    format === "url" ||
    key === "image" ||
    key.includes("imageurl") ||
    key.endsWith("url")
  ) {
    return `https://picsum.photos/seed/${randomToken()}/800/600`;
  }
  if (key === "month") return `${localDateInput().slice(0, 7)}-01`;
  if (key === "registrationdate") return localDateInput();
  if (format === "date" || key.includes("dateofbirth")) {
    const child = siblingFields.has("schoolLevel") || siblingFields.has("clothingSize");
    return birthDate(child);
  }
  if (key.endsWith("id") || key.endsWith("by")) return "";
  if (key === "name") {
    if (siblingFields.has("sku")) return `Test product ${randomToken(4)}`;
    if (siblingFields.has("slug")) return `Test category ${randomToken(4)}`;
    return "Test User";
  }
  if (key.includes("legalname")) return "Test User";
  if (key.includes("phone")) return `+2126${randomDigits(8)}`;
  if (key.endsWith("cin")) return `AB${randomDigits(6)}`;
  if (key.includes("address")) return `10 Test Street, ${pick(CITIES)}`;
  if (key.includes("schoollevel")) return pick(SCHOOL_LEVELS);
  if (key.includes("clothingsize")) return pick(CLOTHING_SIZES);
  if (key.includes("shoesize")) return "36";
  if (key.includes("relationship")) return "Legal guardian";
  if (key.includes("activationtargetmad")) return "7500";
  if (key === "slug") return `test-${randomToken(6)}`;
  if (key === "sku") return `TEST-${randomToken(8).toUpperCase()}`;
  if (
    key.includes("amountmad") ||
    key.includes("pricemad") ||
    key.includes("limitmad") ||
    key.includes("targetmad")
  ) {
    return "100.00";
  }
  if (key.includes("reason")) return "Generated for form testing.";
  if (key.includes("notes")) return "Generated form testing note.";
  if (key.includes("description")) return "Generated description for form testing.";
  if (key.includes("code")) return randomToken(8).toUpperCase();

  return `Test ${fieldName}`;
}

/** Build form-shaped test values from a Zod object schema. */
export function buildFormFill<TSchema extends ZodTypeAny>(
  schema: TSchema,
  overrides: FormFillOverrides = {},
): Partial<TypeOf<TSchema>> {
  const shape = objectShape(schema) ?? {};
  const siblingFields = new Set(Object.keys(shape));
  const output: Record<string, unknown> = {};

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    if (Object.prototype.hasOwnProperty.call(overrides, fieldName)) {
      output[fieldName] = resolveOverride(overrides[fieldName], fieldName);
      continue;
    }

    const nestedShape = objectShape(fieldSchema);
    if (nestedShape) {
      output[fieldName] = buildFormFill(fieldSchema as unknown as ZodTypeAny);
      continue;
    }

    const element = arrayElement(fieldSchema);
    if (element) {
      output[fieldName] = objectShape(element)
        ? [buildFormFill(element as unknown as ZodTypeAny)]
        : [fieldValue(fieldName, element, siblingFields)];
      continue;
    }

    output[fieldName] = fieldValue(fieldName, fieldSchema, siblingFields);
  }

  return output as Partial<TypeOf<TSchema>>;
}
