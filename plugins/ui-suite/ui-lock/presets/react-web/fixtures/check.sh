#!/usr/bin/env bash
# react-web preset: bad fixtures fail with the expected rules, good fixtures pass.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
lockroot="$(cd "$here/../../.." && pwd)"
bin="$lockroot/node_modules/.bin"
if [[ ! -x "$bin/eslint" || ! -x "$bin/stylelint" ]]; then
  echo "SKIP react-web: linters not installed (run: npm ci --prefix plugins/ui-suite/ui-lock)"
  exit 0
fi
cd "$here"
out="$(mktemp)"; trap 'rm -f "$out"' EXIT

expect() { # <json file> <jq filter for count> <expected> <label>
  local got; got="$(jq "$2" "$1")"
  if [[ "$got" == "$3" ]]; then echo "PASS react-web $4 = $3"; else echo "FAIL react-web $4: expected $3, got $got"; exit 1; fi
}
eslint_count() { echo "[.[].messages[] | select(.ruleId == \"$1\")] | length"; }

"$bin/eslint" -f json src/bad.tsx > "$out" || true
expect "$out" "$(eslint_count ui-lock/no-raw-values)" 13 "bad.tsx no-raw-values (7 of them literal style values)"
expect "$out" '[.[].messages[] | select(.ruleId == "ui-lock/no-raw-values" and (.message | startswith("Literal style value")))] | length' 7 "bad.tsx literal style values"
expect "$out" '[.[].messages[] | select(.message | startswith("Raw color"))] | length' 5 "bad.tsx raw colors (2 inside computed style templates)"
expect "$out" "$(eslint_count ui-lock/no-raw-controls)" 2 "bad.tsx no-raw-controls"
expect "$out" "$(eslint_count @eslint-community/eslint-comments/require-description)" 1 "bad.tsx require-description"

"$bin/eslint" -f json src/variants.tsx > "$out" || true
expect "$out" "$(eslint_count ui-lock/no-raw-values)" 13 "variants.tsx no-raw-values (arbitrary values only, not bare variants)"
expect "$out" '[.[].messages[] | select(.message | startswith("Arbitrary value \"p-[13px]\". "))] | length' 1 "variants.tsx message names the matched class"
expect "$out" '[.[].messages[] | select(.message | contains("`bg-(--x)`"))] | length' 1 "variants.tsx var() value suggests the v4 shorthand"
expect "$out" '[.[].messages[] | select(.message | contains("Tailwind v4 shorthand"))] | length' 1 "variants.tsx shorthand suggested only where the rewrite applies"

"$bin/eslint" -f json src/good.tsx ui/Button.tsx > "$out"
expect "$out" '[.[].messages[]] | length' 0 "good.tsx and ui/Button.tsx messages"

# Stylelint writes its report to stderr (https://stylelint.io/user-guide/cli/).
"$bin/stylelint" --formatter json src/bad.css > "$out" 2>&1 || true
expect "$out" '[.[].warnings[] | select(.rule == "color-no-hex")] | length' 1 "bad.css color-no-hex"
expect "$out" '[.[].warnings[] | select(.rule == "function-disallowed-list")] | length' 1 "bad.css function-disallowed-list"
expect "$out" '[.[].warnings[] | select(.rule == "color-named")] | length' 1 "bad.css color-named"
expect "$out" '[.[].warnings[] | select(.rule == "declaration-property-value-allowed-list")] | length' 2 "bad.css declaration-property-value-allowed-list"
expect "$out" '[.[].warnings[] | select(.rule == "--report-descriptionless-disables")] | length' 1 "bad.css descriptionless disable"

"$bin/stylelint" --formatter json src/good.css tokens.css > "$out" 2>&1
expect "$out" '[.[].warnings[]] | length' 0 "good.css and tokens.css warnings"

# A lint glob that matches no CSS file fails without --allow-empty-input and passes with it.
# (Input that is all ignored, like the token home alone, exits 0 either way.)
if "$bin/stylelint" "none/**/*.css" > "$out" 2>&1; then
  echo "FAIL react-web stylelint on a glob with no files exited 0 without --allow-empty-input"; exit 1
fi
echo "PASS react-web stylelint on a glob with no files fails without --allow-empty-input"
if "$bin/stylelint" --allow-empty-input "none/**/*.css" > "$out" 2>&1; then
  echo "PASS react-web stylelint --allow-empty-input on a glob with no files exits 0"
else
  echo "FAIL react-web stylelint --allow-empty-input on a glob with no files: exit $?"; cat "$out"; exit 1
fi

# DESIGN.md lookup walks up from a nested lint folder; fill markers count as unset.
node --input-type=module -e "
import { readUiSystem } from '$here/../files/read-design.mjs';
const ui = readUiSystem('$here/src');
if (ui.root !== '$here' || ui.tokenHome !== 'tokens.css' || ui.componentHome !== 'ui/') { console.log('FAIL nested lookup', JSON.stringify(ui)); process.exit(1); }
console.log('PASS react-web nested DESIGN.md lookup');
try { readUiSystem('$here/unset'); console.log('FAIL fill marker accepted'); process.exit(1); }
catch (e) { if (!/Token home/.test(e.message)) { console.log('FAIL fill-marker message: ' + e.message); process.exit(1); } console.log('PASS react-web fill marker rejected: ' + e.message); }
try { readUiSystem('$here/noheading'); console.log('FAIL missing heading accepted'); process.exit(1); }
catch (e) { if (!/No \"## UI system\" heading in /.test(e.message)) { console.log('FAIL missing-heading message: ' + e.message); process.exit(1); } console.log('PASS react-web missing heading rejected: ' + e.message); }
"
