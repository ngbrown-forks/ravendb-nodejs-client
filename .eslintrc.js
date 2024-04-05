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
        "unicorn/prefer-node-protocol": "error",
        "unicorn/prevent-abbreviations": "off",
        "unicorn/filename-case": "off",
        "unicorn/no-null": "off",
        "unicorn/catch-error-name": "off",
        "unicorn/no-array-push-push": "off",
        "unicorn/no-lonely-if": "off",
        "unicorn/explicit-length-check": "off",
        "unicorn/numeric-separators-style": "off",
        "unicorn/no-await-expression-member": "off",
        "unicorn/no-zero-fractions": "off"
    }
}
