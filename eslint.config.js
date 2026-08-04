import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import vuePlugin from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import globals from "globals";

const 通用规则 = {
  complexity: ["warn", 12],
  "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
  "simple-import-sort/exports": "error",
  "simple-import-sort/imports": "error",
};

export default [
  {
    ignores: ["node_modules/**", "**/dist/**", "coverage/**", "deliverables/**"],
  },
  js.configs.recommended,
  {
    files: ["apps/**/*.ts", "packages/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...通用规则,
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },
  {
    files: ["apps/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: [".vue"],
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "simple-import-sort": simpleImportSort,
      vue: vuePlugin,
    },
    rules: {
      ...vuePlugin.configs["flat/recommended"].at(-1).rules,
      ...通用规则,
      "no-undef": "off",
      "no-unused-vars": "off",
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
