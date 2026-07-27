// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "**/vitest.config.ts",
      "**/.next/**",
      "apps/dashboard/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // NestJS modules and gateways are decorator-driven empty classes.
      "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
    },
  },
  {
    // Config files at the repo root are not part of a TS project.
    files: ["*.mjs", "*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Specs are executed by Vitest and excluded from the composite tsc project.
    files: ["**/*.spec.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettierConfig,
);
