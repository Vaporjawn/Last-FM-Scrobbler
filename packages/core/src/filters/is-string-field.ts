import { STRING_FIELD_ACCESSORS } from "./string-field-accessors.js";

/** Whether `name` is a recognized string-typed filter expression field. */
export function isStringField(name: string): boolean {
  return name in STRING_FIELD_ACCESSORS;
}
