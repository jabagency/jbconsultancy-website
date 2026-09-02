import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Inline <script> blocks in .astro files run in the browser and are not
  // type-checked by tsc, so the TS-aware rules do not apply to them.
  {
    files: ['**/*.astro/*.ts', '**/*.astro/*.js'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },

  {
    files: ['tools/**/*.mjs', '*.config.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
);
