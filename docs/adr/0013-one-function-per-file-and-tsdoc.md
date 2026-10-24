# 0013: One function per file, and TSDoc on every declaration

## Status

Accepted

## Context

By the time the app was feature-complete, several source files had grown into grab-bags:
the desktop startup file wired thirty services in one body, the relay Worker held its rate
limiter, body reader and error mapper side by side, the filter parser held its tokenizer and
every evaluator, and `scripts/run-workspaces.mjs` held its whole package-graph walker. Each
file was readable only after reading all of it, a unit test could not import one behaviour
without pulling in its neighbours, and the same small helpers (a track-equality check, a
duration formatter, an "is this URL ours" test) had been re-written in two or three places
because finding the existing one meant opening a large file.

Documentation had the same problem in the other direction: some modules explained _why_
in depth while others, written later, had no comments at all.

## Decision

Two rules, enforced by lint (`eslint-rules/`, wired into the root `eslint.config.js`) and
therefore by CI on every pull request.

**`structure/one-function-per-file`.** A source file declares at most one top-level
function-like unit: a function declaration, a class, or a variable initialised with an arrow
or function expression (a React component is one of these). Types, interfaces, enums and
constants may sit beside it, because they are data, and a type used by several units gets its
own file. Nested closures belong to their enclosing function and are not counted. Mutually
recursive functions import each other across files; if that is unworkable, the recursion is
a sign the two are one unit and should be one function.

**`structure/require-tsdoc`.** Every function, class, class method, interface, type alias,
enum and exported constant has a `/** ... */` block above it with a real description (a
short sentence at least; `/** Foo. */` above `foo` fails). Named closures inside functions
(a React event handler, a helper inside a factory) are documented too; anonymous callbacks
and object-literal methods are not. A comment should say what the unit does and, where the
reason is not obvious from the name and signature, why it is built that way.

Scope: every non-test source file under `apps/*/src`, `packages/*/src`, `services/*/src`
and the `.mjs` tooling scripts. Exempt: `*.test.ts(x)`, anything under `tests/` or `e2e/`,
`*.d.ts`, and build or config files (`vite`, `vitest`, `electron-builder`, `eslint` configs),
which are declarative and have no functions of their own to separate. A test file groups many
small helpers and cases by design.

File naming: a file is named after the one thing it declares, in the casing the folder
already uses: kebab-case for functions (`resolve-session-bus-address.ts`) and PascalCase for
React components and classes (`NowPlayingArtwork.tsx`). Files live in the existing
feature-then-role folders (`main/startup/`, `core/src/queue/`, `renderer/src/pages/`), not in
a repository-wide `utils/` bucket.

The rules are tested in `eslint-rules/tests/` (`<pm> run test:lint-rules`) with ESLint's
`RuleTester`, including the cases they must reject.

## Consequences

- Many more, smaller files. Finding a behaviour means finding its file name, and a diff for
  one behaviour touches one file. The cost is more import lines and a longer file tree.
- Wiring code that used to be one long function (the desktop startup sequence) is now a
  list of small `wire-*` and `create-*` functions called from one orchestrator. State that
  must stay alive across them (the main window, the tray, the quitting flag) is owned by the
  orchestrator and passed to the helpers as accessors, not as module-level `let`s.
- Module-level mutable state that several functions share (the relay's request log) lives in
  its own state file exported as a constant object, and functions import that object.
- Not adopted: a folder per file (`normalize-date/normalize-date.ts`). The codebase already
  used flat kebab-case files inside role folders, and an extra directory level per function
  doubles path depth without making anything easier to find. If the project later wants it,
  the rule file names are already one-to-one with their contents, so it would be a mechanical
  move.
- The rule does not judge naming or granularity beyond "one function". Reviewers still decide
  whether a unit's name says what it does and whether a helper is shared enough to deserve
  its own file; the lint rule only prevents the grab-bag.
- A new contributor adding a second function to a file gets a lint error naming the first
  function, so the fix (a new file next to it) is obvious.
