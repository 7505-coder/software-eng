export default [
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['node_modules/**', 'client/dist/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        import: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly'
      }
    },
    rules: {}
  }
];
