import { isNumericField } from "./is-numeric-field.js";
import { isStringField } from "./is-string-field.js";

/** Whether `name` is any recognized filter expression field, string or numeric. */
export function isKnownField(name: string): boolean {
  return isStringField(name) || isNumericField(name);
}
