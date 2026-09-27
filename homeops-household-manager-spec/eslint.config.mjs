// HomeOps — ESLint flat config (T-PLAT-009, T-PLAT-006).
//
// Two jobs: (1) the usual correctness rules for TypeScript + React, and (2) the import boundaries
// from docs/architecture/MODULE-MAP.md, which are the tenancy guarantee's first line of defence.

import tseslint from 'typescript-eslint';
import boundaries from './eslint-local/boundaries.mjs';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'coverage/**',
      'migrations/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'docs/**',
    ],
  },

  // `@eslint/js` no longer ships separately with ESLint 10; typescript-eslint re-exports the core
  // recommended set (DECISIONS.md 2026-09-27, "lint configuration").
  tseslint.configs.eslintRecommended,
  ...tseslint.configs.recommended,

  {
    plugins: { homeops: boundaries },
    rules: {
      'homeops/boundaries': 'error',
      // A skeleton that stops throwing must be replaced, not commented out (AGENTS.md §7).
      'no-warning-comments': ['warn', { terms: ['todo', 'fixme'], location: 'start' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Type-aware rules (`no-floating-promises`, `recommendedTypeChecked`) need `projectService`;
      // deferred until the lint budget in TESTING.md §6 is measured (DECISIONS.md 2026-09-27).
    },
  },

  {
    // Scripts and config run in Node with top-level await and console output by design.
    // Tooling scripts are dependency-free Node programs that print to stdout by design
    // (T-PLAT-008, T-PLAT-015, T-PLAT-018); product-code rules do not apply to them.
    files: ['scripts/**/*.ts', 'scripts/**/*.mjs', '*.config.ts', '*.config.mjs', 'eslint-local/**/*.mjs'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    files: ['src/app/**/*.tsx', 'src/features/**/*.tsx', 'src/shared/ui/**/*.tsx'],
    rules: {
      // React rules are not installed: components are server-rendered primitives and the design
      // system forbids client-side state libraries (DESIGN-SYSTEM.md §1, STACK-2026 §3).
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
);
