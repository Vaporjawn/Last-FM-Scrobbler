import { type LogLevel } from "./log-level.js";
import { type LogSeverity } from "./log-severity.js";

/** Whether a message of `severity` should be recorded at the configured `level`: nothing at `none`, everything but debug at `basic`, everything at `debug`. */
export function isEnabled(level: LogLevel, severity: LogSeverity): boolean {
  if (level === "none") {
    return false;
  }
  if (level === "basic" && severity === "debug") {
    return false;
  }
  return true;
}
