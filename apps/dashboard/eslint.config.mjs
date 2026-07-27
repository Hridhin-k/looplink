import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

/**
 * Dashboard ESLint config.
 *
 * Uses `eslint-config-next` for App Router rules and disables formatting rules
 * that conflict with the monorepo Prettier setup.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "vitest.config.ts"]),
]);

export default eslintConfig;
