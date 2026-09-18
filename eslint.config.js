import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/out/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.wrangler/**",
      "**/native-build/**",
    ],
  },
  js.configs.recommended,
  {
    // Type-aware linting, scoped to TS files only. `extends` (rather than spreading
    // these configs at the top level) keeps the parser/parserOptions they set scoped to
    // `files` too — spreading unscoped would leak `typescript-eslint/parser` onto the
    // plain-JS tooling scripts below and break them. Every `.ts`/`.tsx` file — including
    // each package's `vitest.config.ts` and desktop's `tests/**` — is covered by its
    // workspace package's own tsconfig `include`, so the project service can resolve
    // all of them without a default-project fallback.
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  eslintConfigPrettier,
  {
    // Root-level tooling scripts and config files run directly under Node, not
    // bundled by Vite/tsup like package source does — they need Node's globals
    // (process, console, URL, ...) declared explicitly.
    files: ["*.js", "*.mjs", "*.cjs", "**/scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // `apps/desktop/src/renderer/public/` is Vite's `publicDir` — files here are
    // copied verbatim into the built renderer output and served as real static
    // assets (see `renderer/index.html`'s `/favicon.png` and `/theme-init.js`), not
    // bundled/transpiled by Vite the way `renderer/src/**` is. `theme-init.js`
    // specifically is a plain classic `<script src>` loaded directly by `index.html`
    // (deliberately not a module — see its own comment), so it needs real browser
    // globals (`window`, `document`) declared, same reasoning as the Node-scripts
    // block above just for the opposite runtime.
    files: ["apps/desktop/src/renderer/public/**/*.js"],
    languageOptions: {
      globals: globals.browser,
    },
  },
);
