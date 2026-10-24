import { type ComparisonNode } from "./comparison-node.js";
import { type AndNode } from "./and-node.js";
import { type OrNode } from "./or-node.js";
import { type NotNode } from "./not-node.js";

export type AstNode = ComparisonNode | AndNode | OrNode | NotNode;
