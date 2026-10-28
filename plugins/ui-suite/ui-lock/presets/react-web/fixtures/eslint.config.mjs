import tseslint from 'typescript-eslint';
import uiLock from '../files/eslint.mjs';

export default [
  { files: ['**/*.tsx'], languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } } },
  ...uiLock(import.meta.dirname),
];
