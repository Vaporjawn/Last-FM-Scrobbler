import { type ComparisonNode } from "./comparison-node.js";
import { type AndNode } from "./and-node.js";
import { type OrNode } from "./or-node.js";
import { type NotNode } from "./not-node.js";

/**
 * Any node of a parsed filter expression tree: a leaf field comparison or an `and` /
 * `or` / `not` combinator over child nodes. `Parser` produces it and `evaluate` walks it.
 */
export type AstNode = ComparisonNode | AndNode | OrNode | NotNode;
