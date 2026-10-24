import { getDocumentedNode } from "../helpers/get-documented-node.js";
import { getFunctionUnitName } from "../helpers/get-function-unit-name.js";
import { readTsdocDescription } from "../helpers/has-tsdoc.js";
import { isFunctionLikeInitializer } from "../helpers/is-function-like-initializer.js";

/** Shortest description that can say something about a declaration beyond its own name. */
const MINIMUM_DESCRIPTION_LENGTH = 12;

/**
 * Requires a TSDoc block (`/** ... *\/`) with a real description on every function, class,
 * class member, interface, type alias and enum, and on every exported constant.
 *
 * Named closures inside functions (a React event handler, a helper in a factory) need one too;
 * anonymous callbacks and object-literal methods do not. The description must be at least a
 * short sentence: `/** Foo. *\/` above `foo` says nothing the name does not.
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require a TSDoc description on functions, classes, members, types and exported constants",
    },
    schema: [],
    messages: {
      missing: 'Add a TSDoc comment describing {{kind}} "{{name}}".',
      tooShort:
        'The TSDoc comment on {{kind}} "{{name}}" needs a real description (at least a short sentence).',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /** Reports `node` when it lacks a sufficiently long doc description. */
    const check = (node, kind, name, reportNode = node) => {
      const description = readTsdocDescription(sourceCode, getDocumentedNode(node));
      if (description === null) {
        context.report({ node: reportNode, messageId: "missing", data: { kind, name } });
      } else if (description.length < MINIMUM_DESCRIPTION_LENGTH) {
        context.report({ node: reportNode, messageId: "tooShort", data: { kind, name } });
      }
    };

    const isTopLevel = (node) => {
      const parent = node.parent;
      return (
        parent.type === "Program" ||
        ((parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration") &&
          parent.parent.type === "Program")
      );
    };
    const isExported = (node) =>
      node.parent.type === "ExportNamedDeclaration" ||
      node.parent.type === "ExportDefaultDeclaration";

    return {
      FunctionDeclaration(node) {
        check(node, "function", node.id ? node.id.name : "default", node.id ?? node);
      },
      ClassDeclaration(node) {
        check(node, "class", node.id ? node.id.name : "default", node.id ?? node);
      },
      TSInterfaceDeclaration(node) {
        if (isTopLevel(node)) {
          check(node, "interface", node.id.name, node.id);
        }
      },
      TSTypeAliasDeclaration(node) {
        if (isTopLevel(node)) {
          check(node, "type", node.id.name, node.id);
        }
      },
      TSEnumDeclaration(node) {
        if (isTopLevel(node)) {
          check(node, "enum", node.id.name, node.id);
        }
      },
      VariableDeclaration(node) {
        const unitName = getFunctionUnitName(node);
        if (unitName !== null) {
          check(node, "function", unitName);
          return;
        }
        if (isTopLevel(node) && isExported(node)) {
          const [first] = node.declarations;
          if (first && first.id.type === "Identifier" && !isFunctionLikeInitializer(first.init)) {
            check(node, "constant", first.id.name, first.id);
          }
        }
      },
      MethodDefinition(node) {
        const name = node.key.type === "Identifier" ? node.key.name : "member";
        check(node, "method", name, node.key);
      },
      TSAbstractMethodDefinition(node) {
        const name = node.key.type === "Identifier" ? node.key.name : "member";
        check(node, "method", name, node.key);
      },
      PropertyDefinition(node) {
        if (isFunctionLikeInitializer(node.value)) {
          const name = node.key.type === "Identifier" ? node.key.name : "member";
          check(node, "method", name, node.key);
        }
      },
    };
  },
};
