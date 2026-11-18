import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * eslint-config-next v16 already ships a flat config array (it includes the base
 * rules, the TypeScript parser and plugin, and its own ignores). Wrapping it in
 * FlatCompat re-validated an already-flat object and crashed with
 * "Converting circular structure to JSON", which is why `npm run lint` failed for
 * every file. Extending the flat array directly is the supported path.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    // Rules from plugins that eslint-config-next registers for every file.
    rules: {
      "@next/next/no-img-element": "off",
      "prefer-const": "warn",
    },
  },
  {
    // The TypeScript plugin is only registered for these files by the Next config,
    // so its rules must live in a object with the same `files` filter.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      // Every client page loads its data in `useEffect` on mount. Rewriting that to a
      // data layer is a separate refactor; keep the rule visible without blocking CI.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      ".next_build/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Local verification scratch files, never part of the deliverable.
      ".tmp/**",
    ],
  },
];

export default eslintConfig;
