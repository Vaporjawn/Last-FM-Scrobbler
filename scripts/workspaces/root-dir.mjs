import { fileURLToPath } from "node:url";

/** Absolute path of the repository root, derived from this file's own location. */
export const rootDir = fileURLToPath(new URL("../..", import.meta.url));
