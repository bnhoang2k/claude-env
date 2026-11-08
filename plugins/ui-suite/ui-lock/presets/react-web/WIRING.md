Wire ui-lock react-web into this folder's lint:

1. Install: `npm i -D @eslint-community/eslint-plugin-eslint-comments@4.8.1 stylelint@17.16.0` (`pnpm add -D` in a pnpm repo).
2. In eslint.config: `import uiLock from './.ui-lock/eslint.mjs';` and spread `...uiLock(import.meta.dirname)` as the last entries of the config array.
3. Create `stylelint.config.mjs`: `import uiLock from './.ui-lock/stylelint.mjs'; export default uiLock(import.meta.dirname);`
4. Make the lint script run both: `eslint . && stylelint --allow-empty-input "**/*.css"`. The flag keeps lint green when the glob matches no CSS file. Make sure CI runs the lint script.
5. Add `.ui-lock/` to `.prettierignore` if the repo uses Prettier.
6. Generated and vendor files: the preset lints `**/*.{js,jsx,ts,tsx,mjs,cjs}`, so it reaches generated files such as msw's `public/mockServiceWorker.js`. Add them to the host config's `ignores`. Do not edit or delete the directives inside them.
7. shadcn components: R1 applies inside the component home too. After `npx shadcn add`, run lint and convert each reported raw value to a token class or `var(--…)`. Do not disable the rule. Re-running `shadcn add` on the same component overwrites those conversions, so review the diff and reapply them.
8. Existing code only: `npx eslint . --suppress-rule ui-lock/no-raw-values --suppress-rule ui-lock/no-raw-controls --suppress-rule @eslint-community/eslint-comments/require-description`, then commit `eslint-suppressions.json`. Delete any unused `eslint-disable` directives the baseline reports; do not suppress them. New code must be clean. After fixing a suppressed violation, run `npx eslint . --prune-suppressions` and commit the file.
