// ui-lock react-web preset for ESLint flat config. R1: no raw values outside the
// token home. R2: no raw controls outside the component home. Usage, at the end
// of eslint.config: ...uiLock(import.meta.dirname)
import { relative, resolve } from 'node:path';
import comments from '@eslint-community/eslint-plugin-eslint-comments';
import { readUiSystem } from './read-design.mjs';

// A hex color. The lookahead (not \b) lets ids like `#add-item` pass.
const HEX = /#[0-9a-fA-F]{3,8}(?![\w-])/;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
// A Tailwind arbitrary value (`p-[13px]`) or arbitrary property (`[margin:13px]`), with any
// variant prefixes (`md:hover:`), important marks (`!p-[13px]`, `p-[13px]!`) and a slash
// modifier (`text-[13px]/[20px]`). The bracket must end the class, so bare variants like
// `data-[state=open]:bg-accent` and `[&>svg]:size-4` pass.
const ARBITRARY = /(?:^|\s)!?(?:[^\s:]+:)*!?(?:[\w-]*-\[[^\]]+\]|\[[\w-]+:[^\]]+\])(?:\/[^\s:]+)?!?(?=\s|$)/;
const RAW_CONTROLS = new Set(['button', 'input', 'select', 'textarea']);

// A raw style string: a size or weight (any digit: '13px', '50%', '600'), a hex color,
// or a color function. CSS keywords ('none', 'flex', 'absolute') and token references
// ('var(--space-2)') pass.
const isRawStyleString = (text) => /\d/.test(text.replace(/var\(--[\w-]+/g, '')) || HEX.test(text) || COLOR_FN.test(text) || /\bcolor\(/.test(text);
// A style value written out by hand: 13, -4, '13px', `4px`. Zero, keyword strings and
// computed values (identifiers, calls, conditionals, template literals with expressions)
// are allowed. Named colors ('red') are a known gap, as in the rest of the rule.
const isLiteralStyleValue = (v) => {
  if (v.type === 'Literal' && typeof v.value === 'number') return v.value !== 0;
  if (v.type === 'Literal' && typeof v.value === 'string') return isRawStyleString(v.value);
  if (v.type === 'TemplateLiteral') return v.expressions.length === 0 && isRawStyleString(v.quasis[0].value.cooked ?? '');
  if (v.type === 'UnaryExpression' && v.operator === '-') return v.argument.type === 'Literal' && typeof v.argument.value === 'number';
  return false;
};
const isStyleAttribute = (node) => node?.type === 'JSXAttribute' && node.name.name === 'style';
// TypeScript wrappers around a style object: `{...} as React.CSSProperties`, `satisfies`, `!`.
const TS_WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression']);
const unwrapTs = (e) => {
  while (TS_WRAPPERS.has(e?.type)) e = e.expression;
  return e;
};
// True when `v` is the value of a property in `style={{ ... }}`, cast or not.
const isStyleObjectValue = (v) => {
  const prop = v.parent;
  const obj = prop?.parent;
  if (prop?.type !== 'Property' || prop.value !== v || obj?.type !== 'ObjectExpression') return false;
  let up = obj.parent;
  while (TS_WRAPPERS.has(up?.type)) up = up.parent;
  return up?.type === 'JSXExpressionContainer' && isStyleAttribute(up.parent);
};
// True when the style check reports the value this string node belongs to. Only then do
// the generic color and arbitrary-value checks skip it, so a computed template such as
// `0 0 ${n}px #ff0000` is still checked for raw colors.
const isOwnedByStyleCheck = (node) => {
  let v = node.type === 'TemplateElement' ? node.parent : node;
  if (v.parent?.type === 'UnaryExpression') v = v.parent;
  return isStyleObjectValue(v) && isLiteralStyleValue(v);
};

const noRawValues = {
  meta: {
    type: 'problem',
    schema: [{ type: 'object' }],
    messages: {
      color: 'Raw color "{{text}}". Use a token from {{tokenHome}}.',
      arbitrary: 'Arbitrary value "{{text}}". Use a token from {{tokenHome}}.',
      arbitraryVar: 'Arbitrary value "{{text}}" wraps a CSS variable. Use the Tailwind v4 shorthand `{{fix}}` instead.',
      style: 'Literal style value {{text}}. Use a token class, or pass a computed value or a CSS variable from {{tokenHome}}.',
    },
  },
  create(context) {
    const data = context.options[0] ?? {};
    const check = (node, text) => {
      if (HEX.test(text) || COLOR_FN.test(text)) {
        context.report({ node, messageId: 'color', data: { ...data, text: text.trim().slice(0, 40) } });
        return;
      }
      const m = text.match(ARBITRARY);
      if (!m) return;
      const cls = m[0].trim();
      // `bg-[var(--x)]` has a v4 shorthand, `bg-(--x)`. Suggest it only when the rewrite applies.
      const fix = cls.replace(/\[var\((--[\w-]+)\)\]/, '($1)');
      if (fix !== cls) {
        context.report({ node, messageId: 'arbitraryVar', data: { ...data, text: cls, fix } });
      } else {
        context.report({ node, messageId: 'arbitrary', data: { ...data, text: cls } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string' && !isOwnedByStyleCheck(node)) check(node, node.value);
      },
      TemplateElement(node) {
        if (!isOwnedByStyleCheck(node)) check(node, node.value.raw);
      },
      JSXAttribute(node) {
        if (!isStyleAttribute(node) || node.value?.type !== 'JSXExpressionContainer') return;
        const obj = unwrapTs(node.value.expression);
        if (obj?.type !== 'ObjectExpression') return;
        for (const prop of obj.properties) {
          if (prop.type === 'Property' && isLiteralStyleValue(prop.value)) {
            const text = context.sourceCode.getText(prop.value).slice(0, 40);
            context.report({ node: prop.value, messageId: 'style', data: { ...data, text } });
          }
        }
      },
    };
  },
};

const noRawControls = {
  meta: {
    type: 'problem',
    schema: [{ type: 'object' }],
    messages: { control: 'Raw <{{name}}>. Use the shared component from {{componentHome}}.' },
  },
  create(context) {
    const data = context.options[0] ?? {};
    return {
      JSXOpeningElement(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (name && RAW_CONTROLS.has(name)) context.report({ node, messageId: 'control', data: { ...data, name } });
      },
    };
  },
};

const plugin = { meta: { name: 'ui-lock' }, rules: { 'no-raw-values': noRawValues, 'no-raw-controls': noRawControls } };

export default function uiLock(configDir = process.cwd()) {
  const ui = readUiSystem(configDir);
  const rel = (p) => relative(configDir, resolve(ui.root, p)).replace(/\\/g, '/');
  const data = { tokenHome: ui.tokenHome, componentHome: ui.componentHome };
  const files = ['**/*.{js,jsx,ts,tsx,mjs,cjs}'];
  const exempt = ['**/*.stories.*', '**/*.test.*', '**/*.spec.*'];
  return [
    { ignores: ['.ui-lock/**'] },
    {
      files,
      plugins: { 'ui-lock': plugin, '@eslint-community/eslint-comments': comments },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: { '@eslint-community/eslint-comments/require-description': 'error' },
    },
    { files, ignores: [rel(ui.tokenHome), ...exempt], rules: { 'ui-lock/no-raw-values': ['error', data] } },
    {
      files,
      ignores: [`${rel(ui.componentHome).replace(/\/$/, '')}/**`, ...exempt],
      rules: { 'ui-lock/no-raw-controls': ['error', data] },
    },
  ];
}
