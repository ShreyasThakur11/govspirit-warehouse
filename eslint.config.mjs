import js from '@eslint/js';

/**
 * GovSpirit ships as plain browser scripts with no bundler, so every module is
 * an IIFE that hangs itself off the shared `GovSpirit` namespace. ESLint is
 * configured for that reality: script sourceType, browser globals, and the
 * handful of vendor globals loaded from the CDN.
 */

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  performance: 'readonly',
  matchMedia: 'readonly',
  getComputedStyle: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  FileReader: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  HTMLElement: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  MutationObserver: 'readonly',
  alert: 'readonly',
};

const vendorGlobals = {
  // Loaded on demand or from the CDN — see index.html.
  Chart: 'readonly',
  XLSX: 'readonly',
  jspdf: 'readonly',
  html2canvas: 'readonly',
};

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '**/*.min.js'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...browserGlobals,
        ...vendorGlobals,
        GovSpirit: 'writable',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // Correctness
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-implicit-globals': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-shadow': 'warn',
      'no-return-assign': 'error',
      'no-param-reassign': ['warn', { props: false }],
      'consistent-return': 'warn',

      // Safety — these are the classes of bug this codebase actually had.
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Readability
      curly: ['error', 'multi-line'],
      'object-shorthand': ['error', 'properties'],
      'prefer-template': 'warn',
      'no-nested-ternary': 'off',
    },
  },
  {
    // Build and verification scripts run under Node, not in the browser.
    files: ['eslint.config.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
