module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-refresh'],
  rules: {
    // Underscore-prefixed args/vars are an established convention in this
    // codebase for intentionally-unused regex callback params etc.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // `while (true) { ... await ...; if (done) break; }` is the idiomatic
    // shape for reading a fetch/stream reader in this codebase (see
    // ChatInterface.tsx). checkLoops:false keeps the rule active for real
    // footguns (`if (true)`, `x = true` conditionals) while allowing the
    // legitimate infinite-loop-with-break streaming pattern.
    'no-constant-condition': ['error', { checkLoops: false }],

    // Vite Fast Refresh hygiene only (dev-server HMR quality, not a
    // production correctness or build issue). The codebase idiom of
    // colocating a small constant/helper with the component that uses it
    // trips this rule in ~5 files; fixing it means splitting those files
    // apart purely for a dev-experience nicety, which is out of scope for
    // turning lint into a correctness gate. Left off; revisit only if
    // Fast Refresh reliability during `npm run dev` becomes a real problem.
    'react-refresh/only-export-components': 'off',
  },
  overrides: [
    // HANDS-OFF FILES (owned by other in-flight agents at the time this
    // lint gate was enabled). Do not "fix" these by editing the files;
    // only the specific pre-existing violations are silenced here so the
    // repo-wide gate can stay meaningful everywhere else. Revisit once
    // those files are no longer being concurrently edited.
    {
      // Pre-existing: 178 no-mixed-spaces-and-tabs (indentation choice
      // predates this lint pass), 3 unused vars, 5 exhaustive-deps.
      files: ['src/pages/Dashboard.tsx'],
      rules: {
        'no-mixed-spaces-and-tabs': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'react-hooks/exhaustive-deps': 'off',
      },
    },
    {
      // Pre-existing: 2 unused vars (unused icon import, unused `navigate`).
      files: ['src/pages/PrivacyPolicy.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
