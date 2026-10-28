// ui-lock react-web preset for Stylelint. R1 for CSS: no raw colors or one-off
// fonts outside the token home. Usage: export default uiLock(import.meta.dirname)
import { relative, resolve } from 'node:path';
import { readUiSystem } from './read-design.mjs';

export default function uiLock(configDir = process.cwd()) {
  const ui = readUiSystem(configDir);
  const rel = (p) => relative(configDir, resolve(ui.root, p)).replace(/\\/g, '/');
  return {
    reportDescriptionlessDisables: true,
    reportNeedlessDisables: true,
    ignoreFiles: [rel(ui.tokenHome), '.ui-lock/**', '**/node_modules/**', '**/dist/**'],
    rules: {
      'color-no-hex': true,
      'color-named': 'never',
      'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch'],
      'declaration-property-value-allowed-list': {
        'font-family': ['/^var\\(/', 'inherit'],
        'font-size': ['/^var\\(/', 'inherit'],
      },
    },
  };
}
