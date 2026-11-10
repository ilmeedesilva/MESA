import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "dist-demo-site/",
      "node_modules/",
      "src/generated-docs.ts",
      "playwright-report/",
      "test-results/",
      "playwright-report-demo-site/",
      "test-results-demo-site/"
    ]
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Scrollable regions (wide tables) must be focusable so keyboard users can scroll them.
      "jsx-a11y/no-noninteractive-tabindex": ["error", { tags: [], roles: ["tabpanel", "region"] }]
    }
  },
  {
    files: ["scripts/**/*.mjs", "*.config.{js,ts}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node }
  }
);
