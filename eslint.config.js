import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module"
        },
        rules: {
            curly: ["warn", "all"],
            eqeqeq: ["warn", "always"],
            "no-else-return": "warn",
            "no-var": "error",
            "prefer-const": "warn",
            "object-shorthand": ["error", "always"],
            "no-unused-vars": ["warn", { args: "after-used", caughtErrors: "none" }],
            "consistent-return": "warn",
            "arrow-body-style": ["warn", "as-needed"]
        }
    },
    {
        ignores: ["coverage/**", "dist/**", "node_modules/**"]
    }
]);
