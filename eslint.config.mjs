import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import preferArrowFunctions from "eslint-plugin-prefer-arrow-functions";

// Same rules as boyanliu.me: Next's recommended sets, Prettier owns formatting, modern syntax.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Modern syntax: arrow functions instead of `function`, no `var`, template strings, shorthand.
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,tsx}"],
    plugins: { "prefer-arrow-functions": preferArrowFunctions },
    rules: {
      "prefer-arrow-functions/prefer-arrow-functions": [
        "error",
        // Object method shorthand (`{ load() {} }`) is ES6 too, and what object-shorthand asks for.
        { allowObjectProperties: true, returnStyle: "unchanged" },
      ],
      "prefer-arrow-callback": "error",
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
    },
  },
  // Next.js route files keep the framework's `export default function Page()` convention.
  {
    files: [
      "src/app/**/{page,layout,not-found,error,loading,template,default,route,icon,apple-icon,manifest}.{ts,tsx}",
    ],
    rules: { "prefer-arrow-functions/prefer-arrow-functions": "off" },
  },
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
