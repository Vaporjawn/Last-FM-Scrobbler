import { type LogLevel } from "./log-level.js";
import { type LogSeverity } from "./log-severity.js";

export function isEnabled(level: LogLevel, severity: LogSeverity): boolean {
  if (level === "none") {
    return false;
  }
  if (level === "basic" && severity === "debug") {
    return false;
  }
  return true;
}
