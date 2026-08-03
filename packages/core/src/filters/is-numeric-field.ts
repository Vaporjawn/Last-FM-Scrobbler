import { NUMERIC_FIELD_ACCESSORS } from "./numeric-field-accessors.js";

/** Whether `name` is a recognized numeric-typed filter expression field. */
export function isNumericField(name: string): boolean {
  return name in NUMERIC_FIELD_ACCESSORS;
}
