import globals from 'globals';
export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  {
    files: [
      'api/**/*.js',
      'lib/**/*.{js,cjs}',
      'src/**/*.js',
      'scripts/**/*.{js,cjs,mjs}',
      'tests/**/*.{js,cjs}',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'valid-typeof': 'error',
      'constructor-super': 'error',
      'no-async-promise-executor': 'error',
    },
  },
];
