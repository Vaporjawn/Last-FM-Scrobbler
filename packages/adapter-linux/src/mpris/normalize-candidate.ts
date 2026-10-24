import { decodeEscapes } from "./decode-escapes.js";

export function normalizeCandidate(candidate: string): string {
  const separator = candidate.indexOf(":");
  if (separator === -1 || candidate.slice(0, separator).toLowerCase() !== "unix") {
    return candidate;
  }

  const parameters = candidate
    .slice(separator + 1)
    .split(",")
    .map((parameter) => {
      const equals = parameter.indexOf("=");
      if (equals === -1) {
        return parameter;
      }
      const key = parameter.slice(0, equals);
      const value = parameter.slice(equals + 1);
      if (key === "path") {
        return `socket=${decodeEscapes(value)}`;
      }
      if (key === "abstract") {
        return `socket=\u0000${decodeEscapes(value)}`;
      }
      return parameter;
    });

  return `${candidate.slice(0, separator)}:${parameters.join(",")}`;
}
