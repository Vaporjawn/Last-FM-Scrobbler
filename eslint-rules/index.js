import oneFunctionPerFile from "./rules/one-function-per-file.js";
import requireTsdoc from "./rules/require-tsdoc.js";

/**
 * The repository's source-structure lint plugin. `one-function-per-file` keeps every source
 * file to a single function, component or class, and `require-tsdoc` keeps every declaration
 * documented. See docs/CONTRIBUTING.md ("Code structure rules") and
 * docs/adr/0013-one-function-per-file-and-tsdoc.md.
 */
export default {
  meta: { name: "structure" },
  rules: {
    "one-function-per-file": oneFunctionPerFile,
    "require-tsdoc": requireTsdoc,
  },
};
