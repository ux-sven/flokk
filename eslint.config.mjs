import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno-kode for Supabase Edge Functions
    "supabase/functions/**",
    // De native appene (og pakkene Xcode og Gradle laster ned dit)
    "ios/**",
    "android/**",
  ]),
]);

export default eslintConfig;
