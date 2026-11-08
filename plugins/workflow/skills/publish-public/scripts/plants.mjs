// Plants: fake leaks placed in a temp copy before the blind reviewer reads it.
// The reviewer must find every plant or the run fails. This module makes the
// plants (seeded, so a seed reproduces a run), places them, and scores findings.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, extname, sep } from "node:path";
import { configDir, isBinary } from "./util.mjs";

const TYPES = ["name", "decision", "tool", "project", "path", "process"];
const MIN_PLANTS = 5;
const MIN_SUBTLE = 3;
const LINE_TOLERANCE = 2;

/** Small seeded PRNG. Returns a function giving floats in [0, 1). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/** Fisher-Yates on a copy. */
function shuffle(rng, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cache = new Map(); // by file path, so a changed PUBLISH_PUBLIC_HOME is honoured
function loadData() {
  const file = join(configDir(), "plants.json");
  if (cache.has(file)) return cache.get(file);
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`cannot read ${file}: ${e.message} (copy data/plants.example.json there and edit it)`);
  }
  for (const type of TYPES) {
    for (const subtle of [true, false]) {
      if (!Array.isArray(data.templates) || !data.templates.some((t) => t.type === type && t.subtle === subtle)) {
        throw new Error(`${file}: no ${subtle ? "subtle" : "loud"} template for type "${type}"`);
      }
    }
  }
  cache.set(file, data);
  return data;
}

function fill(template, fillers, rng) {
  return template.replace(/\{(\w+)\}/g, (_, slot) => {
    const list = fillers[slot];
    if (!Array.isArray(list) || list.length === 0) throw new Error(`plants.json: no fillers for slot "${slot}"`);
    return pick(rng, list);
  });
}

/** Plants for one run. Same seed, same plants. At least 5, at least 3 subtle, 4+ types. */
export function makePlants(seed, count = MIN_PLANTS) {
  if (!Number.isInteger(count) || count < MIN_PLANTS) {
    throw new RangeError(`makePlants: need at least ${MIN_PLANTS} plants, got ${count}`);
  }
  const { fillers, templates } = loadData();
  const rng = mulberry32(seed);
  const order = shuffle(rng, TYPES);
  const types = Array.from({ length: count }, (_, i) => order[i % order.length]);
  const subtleCount = Math.min(count, MIN_SUBTLE + Math.floor(rng() * 2));
  const subtleAt = new Set(shuffle(rng, types.map((_, i) => i)).slice(0, subtleCount));
  const used = new Set();
  return types.map((type, i) => {
    const subtle = subtleAt.has(i);
    const pool = templates.filter((t) => t.type === type && t.subtle === subtle);
    let text;
    for (let tries = 0; tries < 50; tries++) {
      text = fill(pick(rng, pool).text, fillers, rng);
      if (!used.has(text)) break;
    }
    used.add(text);
    return { type, subtle, text };
  });
}

// ---------------------------------------------------------------------------
// Placement

const COMMENT = {
  ".js": "//", ".ts": "//", ".mjs": "//", ".cjs": "//", ".tsx": "//", ".jsx": "//",
  ".py": "#", ".sh": "#",
  ".md": "<!--", ".html": "<!--",
  ".css": "/*", ".yaml": "#", ".yml": "#",
};
const JSON_EXT = ".json";
const LOCKFILES = new Set(["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);
// JSON files that must not get a plant: the manifest, and tsconfig files (JSON with comments).
const NO_JSON_PLANT = /^(package\.json|tsconfig(\..+)?\.json)$/i;
const SKIP_DIRS = new Set([".git", "node_modules"]);

/** Index of each line start that is outside strings, templates, block comments. JS family. */
function jsSafeStarts(lines) {
  const safe = new Array(lines.length).fill(false);
  const stack = [{ kind: "code", braces: 0 }];
  let block = false;
  for (let n = 0; n < lines.length; n++) {
    safe[n] = stack.length === 1 && !block;
    const s = lines[n];
    for (let i = 0; i < s.length; i++) {
      const top = stack[stack.length - 1];
      const c = s[i];
      if (block) {
        if (c === "*" && s[i + 1] === "/") { block = false; i++; }
      } else if (top.kind === "tpl") {
        if (c === "\\") i++;
        else if (c === "`") stack.pop();
        else if (c === "$" && s[i + 1] === "{") { stack.push({ kind: "code", braces: 0 }); i++; }
      } else if (c === "/" && s[i + 1] === "/") {
        break;
      } else if (c === "/" && s[i + 1] === "*") {
        block = true; i++;
      } else if (c === "'" || c === '"') {
        for (i++; i < s.length && s[i] !== c; i++) if (s[i] === "\\") i++;
      } else if (c === "`") {
        stack.push({ kind: "tpl" });
      } else if (c === "{") {
        top.braces++;
      } else if (c === "}") {
        if (top.braces === 0 && stack.length > 1) stack.pop();
        else top.braces = Math.max(0, top.braces - 1);
      }
    }
  }
  return stack.length === 1 && !block ? safe : null; // null: scanner lost track, so skip the file
}

/** Same idea for Python: outside triple-quoted strings, brackets and continuations. */
function pySafeStarts(lines) {
  const safe = new Array(lines.length).fill(false);
  let triple = null;
  let depth = 0;
  let cont = false;
  for (let n = 0; n < lines.length; n++) {
    safe[n] = triple === null && depth === 0 && !cont;
    const s = lines[n].replace(/\r$/, "");
    cont = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (triple) {
        if (c === "\\") i++;
        else if (s.startsWith(triple, i)) { i += 2; triple = null; }
      } else if (c === "#") {
        break;
      } else if (c === "'" || c === '"') {
        if (s.startsWith(c.repeat(3), i)) { triple = c.repeat(3); i += 2; }
        else for (i++; i < s.length && s[i] !== c; i++) if (s[i] === "\\") i++;
      } else if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
      else if (c === "\\" && i === s.length - 1) cont = true;
    }
  }
  return triple === null ? safe : null;
}

/** Shell: outside heredocs, quotes and backslash continuations. */
function shSafeStarts(lines) {
  const safe = new Array(lines.length).fill(false);
  let quote = null;
  let heredoc = null;
  let cont = false;
  for (let n = 0; n < lines.length; n++) {
    const s = lines[n].replace(/\r$/, "");
    safe[n] = quote === null && heredoc === null && !cont;
    if (heredoc !== null) {
      if (s.trim() === heredoc) heredoc = null;
      continue;
    }
    cont = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quote) {
        if (c === "\\" && quote === '"') i++;
        else if (c === quote) quote = null;
      } else if (c === "\\") {
        if (i === s.length - 1) cont = true;
        i++;
      } else if (c === "'" || c === '"') quote = c;
      else if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) break;
    }
    if (quote === null) {
      const m = s.match(/<<-?\s*(['"]?)([A-Za-z_][\w]*)\1/);
      if (m) heredoc = m[2];
    }
  }
  return quote === null && heredoc === null ? safe : null;
}

/** CSS: outside comments, strings and parentheses (a multi-line url( or calc( stays whole). */
function cssSafeStarts(lines) {
  const safe = new Array(lines.length).fill(false);
  let comment = false;
  let quote = null;
  let depth = 0;
  for (let n = 0; n < lines.length; n++) {
    safe[n] = !comment && quote === null && depth === 0;
    const s = lines[n].replace(/\r$/, "");
    let continued = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (comment) {
        if (c === "*" && s[i + 1] === "/") { comment = false; i++; }
      } else if (quote) {
        if (c === "\\") { if (i === s.length - 1) continued = true; i++; }
        else if (c === quote) quote = null;
      } else if (c === "/" && s[i + 1] === "*") {
        comment = true; i++;
      } else if (c === "'" || c === '"') {
        quote = c;
      } else if (c === "(") depth++;
      else if (c === ")") depth = Math.max(0, depth - 1);
    }
    if (quote !== null && !continued) quote = null; // a string ends at an unescaped newline
  }
  return comment ? null : safe;
}

/**
 * YAML: line starts that are at column 0, non-blank, outside quoted scalars and flow
 * collections. Block scalar content is indented, so a column 0 line is never inside one.
 * Null for a file with a root-level block scalar (its content may sit at column 0).
 */
function yamlSafeStarts(lines) {
  const safe = new Array(lines.length).fill(false);
  let flow = 0;
  let quote = null;
  let scalar = false;
  for (let n = 0; n < lines.length; n++) {
    const s = lines[n].replace(/\r$/, "");
    if (scalar && (s.trim() === "" || /^\s/.test(s))) continue; // block scalar content
    scalar = false;
    safe[n] = flow === 0 && quote === null && /^[^\s%]/.test(s);
    let end = s.length;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const prev = i === 0 ? " " : s[i - 1];
      if (quote === '"') {
        if (c === "\\") i++;
        else if (c === '"') quote = null;
      } else if (quote === "'") {
        if (c === "'") { if (s[i + 1] === "'") i++; else quote = null; }
      } else if (c === "#" && /\s/.test(prev)) {
        end = i;
        break;
      } else if ((c === '"' || c === "'") && /[\s[{,:?-]/.test(prev)) {
        quote = c;
      } else if (c === "[" || c === "{") flow++;
      else if (c === "]" || c === "}") flow = Math.max(0, flow - 1);
    }
    if (quote === null && /(^|\s)[|>][+-]?\d*[+-]?\s*$/.test(s.slice(0, end))) {
      if (/^(---\s+)?[|>]/.test(s)) return null;
      scalar = true;
    }
  }
  return quote === null ? safe : null;
}

/** Pretty-printed JSON: insert indices right after a line that is exactly "{", when the next line starts a key. */
function jsonSpots(text) {
  try { JSON.parse(text); } catch { return []; }
  const lines = text.split("\n");
  const at = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (lines[i].trim() === "{" && /^\s*"/.test(lines[i + 1])) at.push(i + 1);
  }
  return at;
}

const RAW_TAGS = new Set(["script", "style", "pre", "textarea"]);

/**
 * Markup (HTML and Markdown): for each line, is the start of that line outside every
 * open construct? Tracks multi-line `<!-- -->` comments, multi-line `<tag ...>` openers
 * (with quoted attribute values), raw blocks (script, style, pre, textarea) and, for
 * Markdown, code fences. Markdown also ends an open tag at a blank line.
 */
function markupSafeStarts(lines, { md = false } = {}) {
  const safe = new Array(lines.length).fill(false);
  let comment = false;
  let tag = null; // { name, close, quote }
  let raw = null;
  let fence = null;
  for (let n = 0; n < lines.length; n++) {
    const s = lines[n];
    safe[n] = !comment && !tag && raw === null && fence === null;
    if (md && !comment && !tag && raw === null) {
      const f = s.match(/^\s*(```+|~~~+)/);
      if (fence !== null) {
        if (f && f[1][0] === fence) fence = null;
        continue;
      }
      if (f) {
        fence = f[1][0];
        continue;
      }
    }
    if (md && s.trim() === "") tag = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (comment) {
        if (s.startsWith("-->", i)) { comment = false; i += 2; }
      } else if (raw !== null) {
        if (s.slice(i, i + 2 + raw.length).toLowerCase() === `</${raw}`) {
          tag = { name: raw, close: true, quote: null };
          i += 1 + raw.length;
          raw = null;
        }
      } else if (tag) {
        if (tag.quote) {
          if (c === tag.quote) tag.quote = null;
        } else if (c === '"' || c === "'") {
          tag.quote = c;
        } else if (c === ">") {
          const t = tag;
          tag = null;
          if (!t.close && RAW_TAGS.has(t.name) && s[i - 1] !== "/") raw = t.name;
        }
      } else if (s.startsWith("<!--", i)) {
        comment = true;
        i += 3;
      } else if (c === "<") {
        const m = s.slice(i).match(/^<(\/?)([A-Za-z][\w-]*)/);
        if (m) {
          tag = { name: m[2].toLowerCase(), close: m[1] === "/", quote: null };
          i += m[0].length - 1;
        }
      }
    }
  }
  return safe;
}

const LIST_START = /^\s*([-*+]|\d+[.)])\s/;

/** Markdown spots. comment: at a paragraph break or the top. prose: also plain, not before a list, indent or HTML. */
function mdSpots(lines) {
  let first = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end === -1) return { comment: [], prose: [] };
    first = end + 1;
  }
  const safe = markupSafeStarts(lines.slice(first), { md: true });
  const comment = [];
  const prose = [];
  for (let k = 0; k < safe.length; k++) {
    const i = first + k;
    if (!safe[k] || !(k === 0 || lines[i - 1].trim() === "")) continue;
    comment.push(i);
    const l = lines[i];
    if (!/^[<\s>|]/.test(l) && !LIST_START.test(l) && !/^(#{1,6}\s|[-*_=]{3,}\s*$)/.test(l)) prose.push(i);
  }
  return { comment, prose };
}

// Lines that a new statement must not be put in front of, per language.
const JS_NO_STMT_BEFORE = /^(else|catch|finally|while|case|default)\b|^["']/;
const PY_NO_STMT_BEFORE = /^(else|elif|except|finally)\b|^["']/;
const SH_NO_STMT_BEFORE = /^(then|do|done|fi|esac|else|elif|in)\b|^[\w|"'-]+\)/;

/**
 * Candidate insertion indices (insert before lines[i]) that cannot break the file, as
 * { comment, string, prose }. Comment spots are safe for a comment line. String spots are
 * a subset where a new statement is also safe. Prose spots exist for Markdown only.
 */
function candidates(ext, text) {
  const lines = text.split("\n");
  const col0 = (i) => /^[A-Za-z_$@]/.test(lines[i] ?? "");
  const prev = (i) => (lines[i - 1] ?? "").trim();
  const none = { comment: [], string: [], prose: [], json: [] };
  const comment = [];
  let string = [];
  if (COMMENT[ext] === "//") {
    const safe = jsSafeStarts(lines);
    if (!safe) return none;
    for (let i = 0; i < lines.length; i++) {
      if (!safe[i]) continue;
      if (i === 0 ? !lines[0].startsWith("#!") : col0(i)) comment.push(i);
    }
    string = comment.filter(
      (i) =>
        !JS_NO_STMT_BEFORE.test(lines[i]) &&
        !prev(i).startsWith("@") &&
        !/^(export\s+)?(declare\s+)?(async\s+)?function\b.*;$/.test(prev(i)),
    );
  } else if (ext === ".py") {
    const safe = pySafeStarts(lines);
    if (!safe) return none;
    const codingAt = [0, 1].filter((i) => /^#.*coding[:=]/.test(lines[i] ?? "") || (i === 0 && lines[0].startsWith("#!")));
    const first = codingAt.length ? Math.max(...codingAt) + 1 : 0;
    for (let i = first; i < lines.length; i++) if (safe[i] && (i === 0 || col0(i))) comment.push(i);
    const lastFuture = lines.reduce((acc, l, i) => (/^from\s+__future__\s/.test(l) ? i : acc), -1);
    string = comment.filter((i) => i > lastFuture && !PY_NO_STMT_BEFORE.test(lines[i]) && !prev(i).startsWith("@"));
  } else if (ext === ".sh") {
    const safe = shSafeStarts(lines);
    if (!safe) return none;
    for (let i = lines[0].startsWith("#!") ? 1 : 0; i < lines.length; i++) if (safe[i] && (i === 0 || col0(i))) comment.push(i);
    string = comment.filter((i) => !SH_NO_STMT_BEFORE.test(lines[i]) && !/(&&|\|\||\|)$/.test(prev(i)));
  } else if (ext === ".html") {
    const safe = markupSafeStarts(lines);
    const afterDoctype = /^\s*<!doctype/i.test(lines[0]) ? 1 : 0;
    for (let i = afterDoctype; i < lines.length; i++) if (safe[i]) comment.push(i);
  } else if (ext === ".md") {
    return { ...none, ...mdSpots(lines) };
  } else if (ext === ".css") {
    const safe = cssSafeStarts(lines);
    if (!safe) return none;
    for (let i = /^@charset\b/i.test(lines[0]) ? 1 : 0; i < lines.length; i++) if (safe[i]) comment.push(i);
  } else if (ext === ".yaml" || ext === ".yml") {
    const safe = yamlSafeStarts(lines);
    if (!safe) return none;
    for (let i = 0; i < lines.length; i++) if (safe[i]) comment.push(i);
  } else if (ext === JSON_EXT) {
    return { ...none, json: jsonSpots(text) };
  }
  return { comment, string, prose: [], json: [] };
}

/** Eligible files under dir, sorted by name so a seed reproduces a placement. */
function eligibleFiles(dir) {
  const out = [];
  const walk = (d) => {
    const entries = readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(p);
      } else if (e.isFile() && !LOCKFILES.has(e.name)) {
        const ext = extname(e.name).toLowerCase();
        if (!(ext in COMMENT || (ext === JSON_EXT && !NO_JSON_PLANT.test(e.name))) || isBinary(p)) continue;
        const text = readFileSync(p, "utf8");
        const spots = candidates(ext, text);
        if (hasSpots(spots)) out.push({ path: p, file: relative(dir, p).split(sep).join("/"), ext, text, spots });
      }
    }
  };
  walk(dir);
  return out;
}

const hasSpots = (spots) => spots.comment.length + spots.string.length + spots.prose.length + spots.json.length > 0;

function commentLine(ext, text) {
  if (/[\r\n]/.test(text) || text.includes("-->")) throw new Error(`placePlants: plant text cannot sit in a comment: ${text}`);
  if (COMMENT[ext] === "/*" && text.includes("*/")) throw new Error(`placePlants: plant text cannot sit in a comment: ${text}`);
  const prefix = COMMENT[ext];
  if (prefix === "<!--") return `<!-- ${text} -->`;
  if (prefix === "/*") return `/* ${text} */`;
  return `${prefix} ${text}`;
}

/** Escape text for a double-quoted string in the file's language. */
function escapeString(ext, text) {
  const chars = ext === ".sh" ? /[\\"$`]/g : /[\\"]/g;
  return text.replace(chars, "\\$&");
}

/** A new top-level statement holding the text as a string. N is unused in the file. */
function stringLine(ext, text, fileText) {
  if (/[\r\n]/.test(text)) throw new Error(`placePlants: plant text cannot sit in a string: ${text}`);
  const used = [...fileText.matchAll(/\bnote(\d+)\b/g)].map((m) => Number(m[1]));
  const name = `note${Math.max(0, ...used) + 1}`;
  const body = escapeString(ext, text);
  if (ext === ".py") return `${name} = "${body}"`;
  if (ext === ".sh") return `${name}="${body}"`;
  return `const ${name} = "${body}";`;
}

/** A new first key in a JSON object, with the indent of the key it goes before. */
function jsonLine(text, fileText, at) {
  if (/[\r\n]/.test(text)) throw new Error(`placePlants: plant text cannot sit in a JSON string: ${text}`);
  const used = [...fileText.matchAll(/\bnote(\d+)\b/g)].map((m) => Number(m[1]));
  const indent = /^\s*/.exec(fileText.split("\n")[at])[0].replace(/\r$/, "");
  return `${indent}"note${Math.max(0, ...used) + 1}": ${JSON.stringify(text)},`;
}

/** The lines to insert for one plant in one style. Prose is a paragraph, so it brings its own blank line. */
function render(style, ext, text, fileText, at) {
  if (style === "json") return [jsonLine(text, fileText, at)];
  if (style === "string") return [stringLine(ext, text, fileText)];
  if (style === "prose") {
    if (/[\r\n]/.test(text)) throw new Error(`placePlants: plant text cannot be a paragraph: ${text}`);
    return [text, ""];
  }
  return [commentLine(ext, text)];
}

/**
 * Insert each plant into its own file, in a style the seeded PRNG picks from what that file allows:
 * a comment line (not JSON), a plain paragraph (Markdown), a new string statement (js, ts, py, sh),
 * or a new first key in a pretty-printed JSON object (never package.json or tsconfig files).
 * Throws, writing nothing, if eligible files are fewer than plants.
 */
export function placePlants(dir, plants, seed) {
  const files = eligibleFiles(dir);
  if (files.length < plants.length) {
    throw new Error(`placePlants: only ${files.length} eligible text files for ${plants.length} plants`);
  }
  const rng = mulberry32((seed + 0x5bd1e995) >>> 0);
  const chosen = shuffle(rng, files).slice(0, plants.length);
  const plan = plants.map((plant, i) => {
    const f = chosen[i];
    const style = pick(rng, ["comment", "prose", "string", "json"].filter((st) => f.spots[st].length > 0));
    const at = pick(rng, f.spots[style]);
    const lines = f.text.split("\n");
    const eol = lines[0].endsWith("\r") ? "\r" : "";
    lines.splice(at, 0, ...render(style, f.ext, plant.text, f.text, at).map((l) => l + eol));
    return { f, body: lines.join("\n"), placed: { ...plant, file: f.file, line: at + 1, style } };
  });
  for (const { f, body } of plan) writeFileSync(f.path, body);
  return plan.map((x) => x.placed);
}

// ---------------------------------------------------------------------------
// Scoring

const normalize = (file) => String(file).replace(/^(\.\/)+/, "");

/**
 * Each plant claims at most one finding: the nearest in its window (same file, line within 2).
 * A tie goes to the lower line. A finding is claimed once. Every other finding is real.
 * Pairs are taken nearest first, so plants with overlapping windows each get their own.
 */
export function scorePlants(findings, placed) {
  const pairs = [];
  placed.forEach((p, pi) => {
    findings.forEach((f, fi) => {
      if (!Number.isFinite(f.line) || normalize(f.file) !== p.file) return;
      const dist = Math.abs(f.line - p.line);
      if (dist <= LINE_TOLERANCE) pairs.push({ pi, fi, dist, line: f.line });
    });
  });
  pairs.sort((a, b) => a.dist - b.dist || a.line - b.line || a.pi - b.pi || a.fi - b.fi);
  const plantTaken = new Set();
  const findingTaken = new Set();
  for (const { pi, fi } of pairs) {
    if (plantTaken.has(pi) || findingTaken.has(fi)) continue;
    plantTaken.add(pi);
    findingTaken.add(fi);
  }
  return {
    caught: placed.filter((_, i) => plantTaken.has(i)),
    missed: placed.filter((_, i) => !plantTaken.has(i)),
    real: findings.filter((_, i) => !findingTaken.has(i)),
  };
}
