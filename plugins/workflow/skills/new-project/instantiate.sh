#!/usr/bin/env bash
# instantiate.sh <archetype> <target_dir> <params.json> [--dry-run]
#
# Renders an archetype from the archetypes/ folder next to this script into <target_dir>:
#   - substitutes every {{UPPER_SNAKE}} token with the value from params.json
#   - *.tmpl files lose the .tmpl suffix; gitignore.tmpl -> .gitignore;
#     CLAUDE.md.tmpl -> CLAUDE.md at target root; flagship agents/hooks/settings
#     land under .claude/;
#     brain Phases-CLAUDE.md -> Phases/CLAUDE.md
#   - exit 2 if any {{TOKEN}} in the sources has no key in params.json
#   - exit 3 if a requested DEV_PORTS entry is already taken in the ports registry
#     ($NEW_PROJECT_PORTS, default ~/.claude/new-project/ports.md)
#   - appends newly claimed ports to the registry (skipped on --dry-run); the
#     registry is created with a one-line header on the first real run
set -euo pipefail

err() { echo "instantiate: $*" >&2; }

ARCHETYPE="${1:?usage: instantiate.sh <archetype> <target_dir> <params.json> [--dry-run]}"
TARGET="${2:?target dir required}"
PARAMS="${3:?params.json required}"
DRY_RUN=0
[[ "${4:-}" == "--dry-run" ]] && DRY_RUN=1

ARCHETYPES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/archetypes"
SRC="$ARCHETYPES/$ARCHETYPE"
SHARED="$ARCHETYPES/_shared"
SOURCES=("$SRC")
[[ "$ARCHETYPE" == flagship || "$ARCHETYPE" == thin-site ]] && SOURCES+=("$SHARED")
PORTS_FILE="${NEW_PROJECT_PORTS:-$HOME/.claude/new-project/ports.md}"

command -v jq >/dev/null 2>&1 || { err "needs jq: https://jqlang.org/download/"; exit 3; }
[[ -d "$SRC" ]] || { err "unknown archetype '$ARCHETYPE' (no $SRC)"; exit 1; }
jq -e . "$PARAMS" >/dev/null || { err "params file is not valid JSON"; exit 1; }

# --- token completeness (exit 2) -------------------------------------------
missing=0
while IFS= read -r tok; do
  key="${tok//\{/}"; key="${key//\}/}"
  if ! jq -e --arg k "$key" 'has($k)' "$PARAMS" >/dev/null; then
    err "missing param: $key"
    missing=1
  fi
done < <(grep -rhoE '\{\{[A-Z_]+\}\}' "${SOURCES[@]}" | sort -u)
[[ $missing -eq 0 ]] || exit 2

# --- port collision (exit 3) ------------------------------------------------
NEW_PORTS=()
if jq -e 'has("DEV_PORTS")' "$PARAMS" >/dev/null; then
  raw="$(jq -r '.DEV_PORTS' "$PARAMS")"
  while IFS= read -r port; do
    [[ -n "$port" ]] || continue
    if [[ -f "$PORTS_FILE" ]] && grep -qE "\b${port}\b" "$PORTS_FILE"; then
      err "port $port already registered in $PORTS_FILE"
      exit 3
    fi
    NEW_PORTS+=("$port")
  done < <(tr ',/: ' '\n' <<<"$raw" | grep -E '^[0-9]+$' || true)
fi

# --- destination mapping -----------------------------------------------------
dest_for() {
  local rel="$1"
  case "$ARCHETYPE/$rel" in
    */gitignore.tmpl)                    echo ".gitignore" ;;
    flagship/CLAUDE.md.tmpl)             echo "CLAUDE.md" ;;
    flagship/sector-CLAUDE.md.tmpl)      echo "docs/sector-CLAUDE.md.example" ;;
    flagship/settings.json.tmpl)         echo ".claude/settings.json" ;;
    flagship/agents/*.tmpl)              echo ".claude/agents/$(basename "${rel%.tmpl}")" ;;
    flagship/hooks/*)                    echo ".claude/hooks/$(basename "$rel")" ;;
    brain/CLAUDE.md.tmpl)                echo "CLAUDE.md" ;;
    brain/Phases-CLAUDE.md)              echo "Phases/CLAUDE.md" ;;
    brain/*)                             echo "$rel" ;;
    thin-site/CLAUDE.md.tmpl)            echo "CLAUDE.md" ;;
    *)                                   echo "${rel%.tmpl}" ;;
  esac
}

# --- render ------------------------------------------------------------------
# Literal {{KEY}} -> value substitution; python for zero escaping hazards.
render() {
  python3 - "$1" "$2" "$PARAMS" <<'PYEOF'
import json, sys
src, dest, params_path = sys.argv[1], sys.argv[2], sys.argv[3]
params = json.load(open(params_path))
text = open(src, encoding="utf-8").read()
for key, val in params.items():
    text = text.replace("{{" + key + "}}", str(val))
open(dest, "w", encoding="utf-8").write(text)
PYEOF
}

manifest=()
while IFS= read -r file; do
  rel="${file#"$SRC"/}"
  dest="$(dest_for "$rel")"
  manifest+=("$dest")
  if [[ $DRY_RUN -eq 0 ]]; then
    mkdir -p "$TARGET/$(dirname "$dest")"
    render "$file" "$TARGET/$dest"
    [[ -x "$file" || "$dest" == *.sh ]] && chmod +x "$TARGET/$dest"
  fi
done < <(find "$SRC" -type f ! -name '.gitkeep' | sort)

# shared templates (flagship and thin-site): the one DESIGN.md at the target root
if [[ ${#SOURCES[@]} -gt 1 ]]; then
  manifest+=("DESIGN.md")
  [[ $DRY_RUN -eq 0 ]] && render "$SHARED/DESIGN.md.tmpl" "$TARGET/DESIGN.md"
fi

# preserve empty scaffold dirs (brain Superpowers zones)
while IFS= read -r keep; do
  rel="${keep#"$SRC"/}"
  manifest+=("$rel")
  [[ $DRY_RUN -eq 0 ]] && { mkdir -p "$TARGET/$(dirname "$rel")"; touch "$TARGET/$rel"; }
done < <(find "$SRC" -type f -name '.gitkeep' | sort)

verb="wrote"
[[ $DRY_RUN -eq 1 ]] && verb="would write"
for entry in "${manifest[@]}"; do
  printf "%s: %s\n" "$verb" "$entry"
done

# --- leftover-token guard ----------------------------------------------------
if [[ $DRY_RUN -eq 0 ]] && grep -rqE '\{\{[A-Z_]+\}\}' "$TARGET"; then
  err "unfilled tokens remain in target:"
  grep -rhoE '\{\{[A-Z_]+\}\}' "$TARGET" | sort -u >&2
  exit 2
fi

# --- register ports ----------------------------------------------------------
if [[ $DRY_RUN -eq 0 && ${#NEW_PORTS[@]} -gt 0 ]]; then
  project="$(jq -r '.PROJECT_NAME // "unknown"' "$PARAMS")"
  mkdir -p "$(dirname "$PORTS_FILE")"
  [[ -f "$PORTS_FILE" ]] || printf '# Port registry: one row per claimed dev port (project | port | purpose)\n' > "$PORTS_FILE"
  for port in "${NEW_PORTS[@]}"; do
    printf '| %s | %s | claimed by /new-project |\n' "$project" "$port" >> "$PORTS_FILE"
  done
fi

exit 0
