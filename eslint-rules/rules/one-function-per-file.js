import { getFunctionUnitName } from "../helpers/get-function-unit-name.js";
import { unwrapExportedDeclaration } from "../helpers/unwrap-exported-declaration.js";

/**
 * Enforces one function (or component, or class) per source file.
 *
 * A file may declare many types, interfaces, enums and constants, but only one top-level
 * function-like unit: a function declaration, a class, or a variable initialised with an
 * arrow or function expression. A second unit is reported so it gets its own file. Nested
 * closures are part of their enclosing function and are not counted.
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require at most one top-level function, component or class per file",
    },
    schema: [],
    messages: {
      extraUnit:
        '"{{name}}" is a second function-like declaration in this file (the first is "{{first}}"). Move it to its own file.',
    },
  },
  create(context) {
    return {
      Program(program) {
        let first = null;
        for (const statement of program.body) {
          const name = getFunctionUnitName(unwrapExportedDeclaration(statement));
          if (name === null) {
            continue;
          }
          if (first === null) {
            first = name;
            continue;
          }
          context.report({ node: statement, messageId: "extraUnit", data: { name, first } });
        }
      },
    };
  },
};
