import { describe, it } from "node:test";

import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";

import structure from "../index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: "module" },
});

tester.run("structure/one-function-per-file", structure.rules["one-function-per-file"], {
  valid: [
    "export function only() {}",
    "export const only = () => 1;",
    "export default class Only {}",
    "export type A = string; export interface B { x: number } export const LIMIT = 3; export function only() {}",
    "export function only() { const inner = () => 1; function nested() {} return inner() + nested(); }",
    "export const settings = { handler() {} };",
    "export function overloaded(a: string): string; export function overloaded(a: number): number; export function overloaded(a: unknown) { return a; }",
    "console.log('entry script with no declarations');",
  ],
  invalid: [
    {
      code: "export function a() {} export function b() {}",
      errors: [{ messageId: "extraUnit", data: { name: "b", first: "a" } }],
    },
    {
      code: "function a() {} export const b = () => 1;",
      errors: [{ messageId: "extraUnit", data: { name: "b", first: "a" } }],
    },
    {
      code: "export class A {} export const b = function () {};",
      errors: [{ messageId: "extraUnit" }],
    },
    {
      code: "export const a = (() => 1) as () => number; export function b() {}",
      errors: [{ messageId: "extraUnit" }],
    },
    {
      code: "export function a() {} export function b() {} export function c() {}",
      errors: [{ messageId: "extraUnit" }, { messageId: "extraUnit" }],
    },
  ],
});

tester.run("structure/require-tsdoc", structure.rules["require-tsdoc"], {
  valid: [
    "/** Adds two numbers together safely. */ export function add() {}",
    "/**\n * Adds two numbers together.\n * @param a The first.\n */\nexport const add = (a: number) => a;",
    "/** Describes the shape of a widget. */ export interface Widget { x: number }",
    "/** A limit on how many retries run. */ export const LIMIT = 3;",
    "const local = 3;",
    "/** Holds the retry counter for a run. */ export class Counter { /** Increments the counter by one step. */ increment() {} }",
    "/** Wraps a thing and exposes it. */ export function outer() { /** Handles the inner click event. */ const onClick = () => 1; return [1].map(() => onClick()); }",
    "/** Describes the shape of a widget. */\n// eslint-disable-next-line no-undef\nexport interface Widget { x: number }",
    "const settings = { handler() {} }; /** Documented helper function here. */ function helper() {}",
  ],
  invalid: [
    { code: "export function add() {}", errors: [{ messageId: "missing" }] },
    { code: "// not a doc\nexport function add() {}", errors: [{ messageId: "missing" }] },
    { code: "/* plain block */ export function add() {}", errors: [{ messageId: "missing" }] },
    { code: "/** Foo. */ export function foo() {}", errors: [{ messageId: "tooShort" }] },
    { code: "export interface Widget { x: number }", errors: [{ messageId: "missing" }] },
    { code: "export type Id = string;", errors: [{ messageId: "missing" }] },
    { code: "export enum Mode { A }", errors: [{ messageId: "missing" }] },
    { code: "export const LIMIT = 3;", errors: [{ messageId: "missing" }] },
    { code: "export const add = () => 1;", errors: [{ messageId: "missing" }] },
    {
      code: "/** Holds the retry counter for a run. */ export class Counter { increment() {} }",
      errors: [{ messageId: "missing" }],
    },
    {
      code: "/** Wraps a thing and exposes it. */ export function outer() { const onClick = () => 1; return onClick; }",
      errors: [{ messageId: "missing" }],
    },
    {
      code: "/** @param a Only a tag, no description. */ export function add(a: number) {}",
      errors: [{ messageId: "tooShort" }],
    },
  ],
});
