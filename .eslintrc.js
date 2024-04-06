// eslint-disable-next-line no-undef
module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:unicorn/recommended"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint",
        "unicorn"
    ],
    "rules": {
        "no-console": "warn",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-unused-vars": "off",

        "unicorn/no-unnecessary-polyfills": "off",
        "unicorn/prefer-string-replace-all": "off",
        "unicorn/import-style": "off",
        "unicorn/prefer-module": "off",
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
}
