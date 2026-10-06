const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'coverage/**'] },
  ...expoConfig,
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: 'Read colours from useTheme(); do not hard-code hex values.',
        },
      ],
    },
  },
  {
    files: ['jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly', require: 'readonly' } },
  },
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', 'src/theme/__tests__/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];
