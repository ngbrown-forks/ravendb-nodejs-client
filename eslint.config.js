import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

export default [
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        plugins: {
            unicorn: eslintPluginUnicorn,
        },
        rules: {
            "no-console": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-inferrable-types": "off",
            "@typescript-eslint/no-unused-vars": "off",

            "unicorn/prefer-type-error": "off",
            "unicorn/prefer-event-target": "off",
            "unicorn/no-array-callback-reference": "off",
            "unicorn/no-this-assignment": "off",
            "unicorn/prefer-object-from-entries": "off",
            "unicorn/prefer-ternary": "off",
            "unicorn/prefer-code-point": "off",
            "unicorn/prefer-switch": "off",
            "unicorn/no-typeof-undefined": "off",
            "unicorn/no-new-array": "off",
            "unicorn/prefer-string-slice": "off",
            "unicorn/prevent-abbreviations": "off",
            "unicorn/no-negated-condition": "off",
            "unicorn/no-for-loop": "off",
            "unicorn/filename-case": "off",
            "unicorn/no-null": "off",
            "unicorn/catch-error-name": "off",
            "unicorn/no-array-push-push": "off",
            "unicorn/no-lonely-if": "off",
            "unicorn/explicit-length-check": "off",
            "unicorn/numeric-separators-style": "off",
            "unicorn/no-await-expression-member": "off",
            "unicorn/no-zero-fractions": "off",
            "unicorn/prefer-native-coercion-functions": "off",
            "unicorn/no-array-method-this-argument": "off",
            "unicorn/no-useless-undefined": "off",
            "unicorn/no-array-reduce": "off",
            "unicorn/better-regex": "off",
            "unicorn/prefer-spread": "off",
            "unicorn/consistent-function-scoping": "off",
        }
    },

];