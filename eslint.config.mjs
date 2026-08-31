// @ts-check
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { sourceType: 'module' },
  },
  files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.js', '**/*.mjs', '**/*.cjs'],
  ignores: ['dist/', 'dist-bundle/'],
  plugins: {
    '@typescript-eslint': tseslint.plugin,
    'unused-imports': unusedImports,
  },
  rules: {
    'no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
  },
});

// The `no-restricted-imports` rule the SDK's config carries is deliberately not
// here. There it forbids `@roarkanalytics/sdk` imports because the SDK is that
// repository - importing your own package by name resolves through
// node_modules and compiles against the last published copy of yourself. This
// package is a consumer of the SDK, so those imports are the point.
