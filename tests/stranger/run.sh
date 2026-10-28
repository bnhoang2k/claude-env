#!/usr/bin/env bash
# Stranger test: what a person gets who installs claude-env on a machine with almost nothing on it.
#
# usage: bash tests/stranger/run.sh [<repo root>]
#
# It installs the plugins into a temp HOME with the Claude Code CLI (`claude plugin marketplace add`,
# then `claude plugin install bnhoang2k@claude-env`), then runs the INSTALLED copies, not the checkout:
#   - every preflight (plugins/*/skills/**/preflight.*), bare and in each mode its usage line names
#   - the scripts a stranger tends to run bare (args.mjs, regrade.mjs, clean-captures.mjs, leak-scan.mjs,
#     deny.mjs, ui-lock.py, crop.py, look.py, measure_actor.py)
#   - every shipped hook, fed each sample payload in tests/stranger/hook-samples/ that matches its
#     event and matcher in hooks.json
# Each probe runs under `env -i` with a PATH that holds symlinks to node, python3, bash and a few
# coreutils, and nothing else. No git, no jq, no ffmpeg, no Blender.
#
# A probe passes when it exits 0, or exits non-zero with a line that says what is missing:
# `needs ...`, `usage:`, `set SOME_VAR` or `run this inside Blender`. It fails on a stack trace
# (`Traceback`, an `at file:line` frame, ERR_MODULE_NOT_FOUND) or a raw ENOENT. On Linux it also
# fails on a /Applications/ path in any line that does not start with `ok `: a Mac may legitimately
# hold Chrome or Blender there, Linux may not.
#
# Prints `PASS <probe>` or `FAIL <probe>` per probe. Exit 0 when all pass, 1 when any fails, 2 when
# the test cannot start (no claude, node or python3). Needs the `claude` CLI on PATH
# (npm install -g @anthropic-ai/claude-code). Runs on bash 3.2 (macOS) and on Linux.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-$(cd "$HERE/../.." && pwd)}"
ROOT="$(cd "$ROOT" && pwd)"
SAMPLES="$ROOT/tests/stranger/hook-samples"

for tool in claude node python3 bash; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "needs $tool: install it before running the stranger test (claude: npm install -g @anthropic-ai/claude-code)" >&2
    exit 2
  }
done
[[ -d "$SAMPLES" ]] || { echo "FAIL no hook samples at $SAMPLES" >&2; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
H="$TMP/home"      # the stranger's HOME
BIN="$TMP/bin"     # the stranger's PATH: symlinks only
WORK="$TMP/work"   # the folder every probe runs in
mkdir "$H" "$BIN" "$WORK"

# ---- install ---------------------------------------------------------------------------------------
if ! HOME="$H" claude plugin marketplace add "$ROOT" >"$TMP/install.log" 2>&1 \
  || ! HOME="$H" claude plugin install bnhoang2k@claude-env >>"$TMP/install.log" 2>&1; then
  echo "FAIL install: claude plugin marketplace add / install did not exit 0"
  cat "$TMP/install.log"
  exit 1
fi
CACHE="$H/.claude/plugins/cache/claude-env"
[[ -d "$CACHE" ]] || { echo "FAIL install: no $CACHE after the install"; cat "$TMP/install.log"; exit 1; }
echo "PASS install: marketplace add + plugin install bnhoang2k@claude-env"

# plugin_dir <name>: the installed copy of one plugin (the one version folder under the cache).
plugin_dir() {
  local d
  for d in "$CACHE/$1"/*/; do
    [[ -d "$d" ]] && { echo "${d%/}"; return 0; }
  done
  return 1
}

# ---- the bare PATH ---------------------------------------------------------------------------------
for tool in node python3 bash sh env cat ls mkdir rm cp mv dirname basename head tail sed grep tr wc sort cut tee date uname readlink pwd test; do
  p="$(command -v "$tool" 2>/dev/null || true)"
  [[ -n "$p" && "$p" == /* ]] && ln -sf "$p" "$BIN/$tool"
done

# ---- the pass rule ---------------------------------------------------------------------------------
FAILS=0
PASSES=0
OS="$(uname -s)"

# judge <label> <exit code> <output file> [<max lines>]: print PASS or FAIL for one finished probe.
# A probe may set CLEAN_EXIT=<n>: exit n is then a clean refusal that needs no keyword line, as long as it
# stays within MAX_LINES (one plain error line, for example a missing input file).
judge() {
  local label="$1" code="$2" out="$3" max="${4:-}" bad="" lines
  if grep -Eq 'Traceback|^[[:space:]]+at .*:[0-9]+|ERR_MODULE_NOT_FOUND|ENOENT' "$out"; then
    bad="printed a stack trace or a raw ENOENT"
  elif [[ "$OS" == "Linux" ]] && awk '!/^ok / && /\/Applications\//{f=1} END{exit !f}' "$out"; then
    bad="named a /Applications/ path on Linux"
  elif [[ "$code" -ne 0 && "$code" != "${CLEAN_EXIT:-}" ]] && ! grep -Eq '(^[[:space:]]*([A-Za-z0-9_.-]+: )?(needs |usage:)|(^|[^A-Za-z])(set [A-Z][A-Z_]+|run this inside Blender))' "$out"; then
    bad="exited $code with no 'needs', 'usage:', 'set VAR' or 'run this inside Blender' line"
  elif [[ -n "$max" ]]; then
    lines="$(wc -l <"$out" | tr -d ' ')"
    [[ "$lines" -le "$max" ]] || bad="printed $lines lines (want at most $max)"
  fi
  if [[ -n "$bad" ]]; then
    echo "FAIL $label: $bad (exit $code)"
    sed 's/^/    | /' "$out" | head -20
    FAILS=$((FAILS + 1))
  else
    echo "PASS $label (exit $code)"
    PASSES=$((PASSES + 1))
  fi
}

# probe <label> <command> [args...]: run in the stranger's environment, stdin closed, output kept.
# The result is also left in $LAST_CODE and $TMP/out for the caller.
LAST_CODE=0
probe() {
  local label="$1"; shift
  LAST_CODE=0
  ( cd "$WORK" && env -i HOME="$H" PATH="$BIN" CLAUDE_PLUGIN_ROOT="${PLUGIN_ROOT:-}" ${LD_LIBRARY_PATH:+LD_LIBRARY_PATH="$LD_LIBRARY_PATH"} "$@" ) >"$TMP/out" 2>&1 </dev/null || LAST_CODE=$?
  judge "$label" "$LAST_CODE" "$TMP/out" "${MAX_LINES:-}"
}

# ---- find the installed copies ---------------------------------------------------------------------
missing_file() { echo "FAIL $1: not in the installed copy"; FAILS=$((FAILS + 1)); }
for plugin in ui-suite motion models workflow figures; do
  plugin_dir "$plugin" >/dev/null || { echo "FAIL install: plugin $plugin missing from the cache"; FAILS=$((FAILS + 1)); }
done
MOTION="$(plugin_dir motion || true)"; MODELS="$(plugin_dir models || true)"
WORKFLOW="$(plugin_dir workflow || true)"; UISUITE="$(plugin_dir ui-suite || true)"
[[ $FAILS -eq 0 ]] || { echo "$PASSES passed, $FAILS failed"; exit 1; }

# ---- preflights ------------------------------------------------------------------------------------
# Run bare. A preflight that wants a mode exits 2 with `usage: ... <a|b|c>`; run each mode too.
PREFLIGHTS="$TMP/preflights.txt"
find "$CACHE" -path '*/skills/*' -name 'preflight.*' -not -path '*/node_modules/*' | sort >"$PREFLIGHTS"
[[ -s "$PREFLIGHTS" ]] || { echo "FAIL preflights: none found under the installed plugins"; FAILS=$((FAILS + 1)); }
while IFS= read -r f; do
  rel="${f#$CACHE/}"
  case "$f" in
    *.mjs|*.js) interp=node ;;
    *.py) interp=python3 ;;
    *) echo "FAIL $rel: unknown preflight type"; FAILS=$((FAILS + 1)); continue ;;
  esac
  PLUGIN_ROOT=""
  probe "preflight $rel" "$BIN/$interp" "$f"
  if [[ $LAST_CODE -eq 2 ]]; then
    modes="$(sed -nE 's/.*<([a-z0-9|-]+)>.*/\1/p' "$TMP/out" | head -1 | tr '|' ' ')"
    if [[ -z "$modes" ]]; then
      echo "FAIL preflight $rel: exited 2 and its usage line names no <mode|mode>"; FAILS=$((FAILS + 1))
    fi
    for mode in $modes; do
      probe "preflight $rel $mode" "$BIN/$interp" "$f" "$mode"
    done
  fi
done <"$PREFLIGHTS"

# ---- scripts a stranger runs bare ------------------------------------------------------------------
SM="$MOTION/skills/steal-mechanism"
for f in "$SM/workflows/args.mjs" "$SM/scripts/regrade.mjs" "$SM/scripts/clean-captures.mjs" "$SM/scripts/intake/leak-scan.mjs" \
         "$WORKFLOW/skills/publish-public/scripts/deny.mjs" "$UISUITE/ui-lock/bin/ui-lock.py" \
         "$UISUITE/skills/unify-ui/scripts/crop.py" "$MODELS/skills/break-models/scripts/look.py" \
         "$MODELS/skills/break-scene/scripts/measure_actor.py" "$MODELS/skills/break-models/scripts/checks.py"; do
  [[ -f "$f" ]] || missing_file "${f#$CACHE/}"
done

probe "args.mjs study" "$BIN/node" "$SM/workflows/args.mjs" '{"mode":"study"}'
probe "args.mjs intake" "$BIN/node" "$SM/workflows/args.mjs" '{"mode":"intake"}'
probe "args.mjs bare" "$BIN/node" "$SM/workflows/args.mjs"
probe "regrade.mjs bare" "$BIN/node" "$SM/scripts/regrade.mjs"
probe "clean-captures.mjs bare" "$BIN/node" "$SM/scripts/clean-captures.mjs"
probe "leak-scan.mjs bare" "$BIN/node" "$SM/scripts/intake/leak-scan.mjs"
probe "leak-scan.mjs missing kit" "$BIN/node" "$SM/scripts/intake/leak-scan.mjs" "$WORK"
probe "deny.mjs bare" "$BIN/node" "$WORKFLOW/skills/publish-public/scripts/deny.mjs"
probe "ui-lock.py status" "$BIN/python3" "$UISUITE/ui-lock/bin/ui-lock.py" status
# A folder with no DESIGN.md: one plain line, exit 3.
CLEAN_EXIT=3 MAX_LINES=1 probe "ui-lock.py status no DESIGN.md" "$BIN/python3" "$UISUITE/ui-lock/bin/ui-lock.py" status "$WORK"
# crop.py: bare prints usage; a missing input file prints one line (exit 2, or 3 when Pillow is missing).
probe "crop.py bare" "$BIN/python3" "$UISUITE/skills/unify-ui/scripts/crop.py"
CLEAN_EXIT=2 MAX_LINES=1 probe "crop.py missing input" "$BIN/python3" "$UISUITE/skills/unify-ui/scripts/crop.py" "$WORK/none.png" 0 0 10 10 "$WORK/out.png"
# look.py without Pillow: made unimportable with sys.modules, so a machine that has Pillow still tests the path.
MAX_LINES=1 probe "look.py --composite without Pillow" "$BIN/python3" -c \
  'import runpy, sys; sys.modules["PIL"] = None; sys.argv = sys.argv[1:]; runpy.run_path(sys.argv[0], run_name="__main__")' \
  "$MODELS/skills/break-models/scripts/look.py" --composite "$WORK/no-layout.json"
if [[ $LAST_CODE -ne 3 ]]; then
  echo "FAIL look.py --composite without Pillow: exit $LAST_CODE (want 3)"; FAILS=$((FAILS + 1))
fi
probe "measure_actor.py outside Blender" "$BIN/python3" "$MODELS/skills/break-scene/scripts/measure_actor.py" -- "$WORK/none.glb"
if [[ $LAST_CODE -ne 3 ]]; then
  echo "FAIL measure_actor.py outside Blender: exit $LAST_CODE (want 3)"; FAILS=$((FAILS + 1))
fi
probe "checks.py outside Blender" "$BIN/python3" "$MODELS/skills/break-models/scripts/checks.py" -- "$WORK/none.glb"
if [[ $LAST_CODE -ne 3 ]]; then
  echo "FAIL checks.py outside Blender: exit $LAST_CODE (want 3)"; FAILS=$((FAILS + 1))
fi

# ---- hooks -----------------------------------------------------------------------------------------
# Fill the sample placeholders: __TMP__ becomes the work folder, which also holds the transcript the
# Stop and SubagentStop samples read (a relative temp page, written with Write and with a shell redirect).
FILLED="$TMP/samples"
mkdir "$FILLED"
for f in "$SAMPLES"/*.json "$SAMPLES"/transcript.jsonl; do
  sed "s|__TMP__|$WORK|g" "$f" >"$FILLED/$(basename "$f")"
done
cp "$FILLED/transcript.jsonl" "$WORK/transcript.jsonl"
printf 'x = 1\n%.0s' $(seq 1 900) >"$WORK/big.py"
printf '<p>a</p>\n' >"$WORK/page.html"

# The matcher logic lives in node: it reads each plugin's hooks.json and pairs every hook command with
# every sample whose event and tool (or SessionStart source) match. It prints one tab-separated line per
# pair, `PAIR <label> <plugin dir> <command> <sample>`, and `NOSAMPLE <label>` for a hook with no sample.
cat >"$TMP/pairs.js" <<'EOF'
const fs = require("fs"), path = require("path");
const [cache, samplesDir, ...plugins] = process.argv.slice(2);
const samples = fs.readdirSync(samplesDir).filter((n) => n.endsWith(".json")).sort()
  .map((n) => ({ name: n, file: path.join(samplesDir, n), data: JSON.parse(fs.readFileSync(path.join(samplesDir, n), "utf8")) }));
for (const dir of plugins) {
  const file = path.join(dir, "hooks", "hooks.json");
  if (!fs.existsSync(file)) continue;
  const plugin = path.basename(path.dirname(dir));
  const hooks = JSON.parse(fs.readFileSync(file, "utf8")).hooks || {};
  for (const [event, entries] of Object.entries(hooks)) {
    for (const entry of entries) {
      const matcher = entry.matcher || "";
      const re = matcher ? new RegExp("^(?:" + matcher + ")$") : null;
      const hit = samples.filter((s) => s.data.hook_event_name === event &&
        (!re || re.test(String(event === "SessionStart" ? s.data.source : s.data.tool_name))));
      if (hit.length === 0) console.log(["NOSAMPLE", `${plugin} ${event}${matcher ? " " + matcher : ""}`].join("\t"));
      for (const h of entry.hooks || []) {
        if (h.type !== "command") continue;
        for (const s of hit) {
          console.log(["PAIR", `${plugin} ${event}${matcher ? " " + matcher : ""} ${path.basename(h.command.split('"')[1] || h.command)} <- ${s.name}`, dir, h.command, s.name].join("\t"));
        }
      }
    }
  }
}
EOF
node "$TMP/pairs.js" "$CACHE" "$FILLED" "$UISUITE" "$WORKFLOW" >"$TMP/pairs.txt" 2>"$TMP/pairs.err" \
  || { echo "FAIL hooks: could not read the hooks.json files"; cat "$TMP/pairs.err"; FAILS=$((FAILS + 1)); }
[[ -s "$TMP/pairs.txt" ]] || { echo "FAIL hooks: no hook and sample pairs found"; FAILS=$((FAILS + 1)); }

tab="$(printf '\t')"
while IFS="$tab" read -r kind label dir cmd sample; do
  case "$kind" in
    NOSAMPLE)
      echo "FAIL hook $label: no sample in tests/stranger/hook-samples/ matches this event and matcher"
      FAILS=$((FAILS + 1)) ;;
    PAIR)
      PLUGIN_ROOT="$dir"
      ( cd "$WORK" && env -i HOME="$H" PATH="$BIN" CLAUDE_PLUGIN_ROOT="$dir" CLAUDE_PROJECT_DIR="$WORK" ${LD_LIBRARY_PATH:+LD_LIBRARY_PATH="$LD_LIBRARY_PATH"} "$BIN/bash" -c "$cmd" ) \
        <"$FILLED/$sample" >"$TMP/out" 2>&1 && code=0 || code=$?
      judge "hook $label" "$code" "$TMP/out" ;;
  esac
done <"$TMP/pairs.txt"

echo
echo "$PASSES passed, $FAILS failed"
[[ $FAILS -eq 0 ]]
