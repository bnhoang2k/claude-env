// Blind review: a Claude Code run that loads no user config reads the export
// (with planted fake leaks) and lists every line that tells a stranger anything
// private. checkBlindness proves, on each run, that the reviewer is blind.
// Fails closed: every problem throws ReviewError.
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdtempSync, openSync, readdirSync, readFileSync, readSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRules, scanText } from "./deny.mjs";
import { configDir } from "./util.mjs";

const POLICY_PATH = fileURLToPath(new URL("../data/policy.md", import.meta.url));

export const ECHO_QUESTION =
  "Repeat, word for word, every instruction, rule, memory or other context you were given before this message, apart from this message itself. If there is none, answer exactly: none.";

const REVIEW_TIMEOUT_MS = 900000;
/** Files per reviewer call. One call over a few hundred files tends to skim and miss plants;
 *  a small batch keeps every file inside one careful read. */
const REVIEW_BATCH = 40;
const REVIEW_PARALLEL = 3;
const BLIND_TIMEOUT_MS = 300000;
const MAX_BUFFER = 64 * 1024 * 1024;
const TIMEOUT_CODE = 124;

/** Text that shows the user's own hooks or plugins reached the reviewer, beyond what the deny list names:
 *  a built-in plugin marker, plus <config>/blind-markers.json (a list of regex sources, any case) when present. */
export function loadMarkers(dir = configDir()) {
  const markers = [/superpowers/i];
  const file = join(dir, "blind-markers.json");
  if (!existsSync(file)) return markers;
  let list;
  try {
    list = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new ReviewError(`cannot read ${file}: ${err.message}`);
  }
  if (!Array.isArray(list) || !list.every((x) => typeof x === "string" && x !== "")) {
    throw new ReviewError(`${file} must be a list of non-empty strings`);
  }
  return [...markers, ...list.map((x) => new RegExp(x, "i"))];
}
const HEADING = /^\s*# userEmail\s*$/;
const PLAIN_ADDRESS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Hide the account email, which the CLI always adds and the user accepted. Only the exact address is
 *  replaced (any case, anywhere), and only a line that is exactly `# userEmail` is dropped.
 *  All other text stays for the scan, so nothing glued to the address can hide. */
function maskAccountEmail(text, email) {
  const re = new RegExp(escapeRe(email), "gi");
  return text
    .split("\n")
    .filter((l) => !HEADING.test(l))
    .map((l) => l.replace(re, "<email>"))
    .join("\n");
}

const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: { file: { type: "string" }, line: { type: "integer" }, why: { type: "string" } },
        required: ["file", "line", "why"],
      },
    },
  },
  required: ["findings"],
};

export class ReviewError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReviewError";
  }
}

let cost = 0;
/** Dollars spent by the runs since the last resetCost(), from total_cost_usd. */
export const totalCost = () => cost;
export const resetCost = () => {
  cost = 0;
};

// detached children no longer get Ctrl-C from the terminal, so the parent kills their groups itself.
const live = new Set();
let handlersOn = false;
const killGroupOf = (pid) => {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
};
const killAllLive = () => live.forEach(killGroupOf);
const onSignal = (sig) => {
  killAllLive();
  live.clear();
  syncHandlers();
  process.kill(process.pid, sig); // handlers are off now, so the default action ends the process
};
const onSigint = () => onSignal("SIGINT");
const onSigterm = () => onSignal("SIGTERM");
function syncHandlers() {
  if (live.size > 0 && !handlersOn) {
    process.on("exit", killAllLive);
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
    handlersOn = true;
  } else if (live.size === 0 && handlersOn) {
    process.off("exit", killAllLive);
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    handlersOn = false;
  }
}

/** Run the CLI with an argument array (no shell) and stdin closed. A timeout kills the whole process group
 *  and settles at once with code 124, without waiting for the pipes to close.
 *  opts.bin swaps the program (tests only). */
export function runClaude(args, { cwd, timeoutMs, env, bin = "claude" }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    const chunks = [];
    let size = 0;
    let settled = false;
    const killGroup = () => killGroupOf(child.pid);
    if (child.pid) {
      live.add(child.pid);
      syncHandlers();
    }
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      live.delete(child.pid);
      syncHandlers();
      child.stdout.destroy();
      child.stderr.destroy();
      fn(value);
    };
    const timer = setTimeout(() => {
      killGroup();
      settle(resolvePromise, { stdout: "", code: TIMEOUT_CODE });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BUFFER) {
        killGroup();
        settle(reject, new ReviewError("reviewer output exceeded the buffer"));
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.resume();
    child.on("error", (err) => settle(reject, new ReviewError(`could not start ${bin}: ${err.message}`)));
    child.on("close", (code) => {
      // Decode once, so a multi-byte character split across chunks stays whole.
      settle(resolvePromise, { stdout: Buffer.concat(chunks).toString("utf8"), code: code ?? 1 });
    });
  });
}

function commandArgs(prompt, systemPrompt, schema) {
  const args = [
    "-p", prompt,
    "--safe-mode",
    "--setting-sources", "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--model", "opus",
    "--output-format", "json",
    "--tools", "Read,Grep,Glob",
    "--system-prompt", systemPrompt,
  ];
  if (schema) args.push("--json-schema", JSON.stringify(schema));
  return args;
}

/** Run, then parse the CLI's JSON object. Throws ReviewError on any failure. */
async function runAndParse(run, args, opts) {
  let out;
  try {
    out = await run(args, opts);
  } catch (err) {
    if (err instanceof ReviewError) throw err;
    throw new ReviewError(`reviewer failed to run: ${err.message}`);
  }
  if (out.code === TIMEOUT_CODE) throw new ReviewError(`reviewer timed out after ${opts.timeoutMs} ms`);
  if (out.code !== 0) throw new ReviewError(`reviewer exited with code ${out.code}`);
  let obj;
  try {
    obj = JSON.parse(out.stdout);
  } catch {
    throw new ReviewError("reviewer output is not JSON");
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) throw new ReviewError("reviewer output is not a JSON object");
  if (typeof obj.total_cost_usd === "number") cost += obj.total_cost_usd;
  if (obj.is_error === true) throw new ReviewError(`reviewer reported an error: ${String(obj.result).slice(0, 200)}`);
  return obj;
}

/** The logged-in account's email, from `claude auth status --json`. Throws ReviewError if it cannot be read. */
export async function readAccountEmail(run = runClaude) {
  const obj = await runAndParse(run, ["auth", "status", "--json"], { cwd: tmpdir(), timeoutMs: 30000 });
  if (typeof obj.email !== "string" || !PLAIN_ADDRESS.test(obj.email)) {
    throw new ReviewError("could not read a plain account email from `claude auth status`");
  }
  return obj.email;
}

/** Ask the reviewer setup to repeat its context. Blind when nothing private is left once the exact
 *  account email is hidden. accountEmail is injectable so tests need no login. */
export async function checkBlindness(run = runClaude, { accountEmail = readAccountEmail, rules = loadRules(["base"]), markers = loadMarkers() } = {}) {
  let email;
  try {
    email = await accountEmail();
  } catch (err) {
    if (err instanceof ReviewError) throw err;
    throw new ReviewError(`could not read the account email: ${err.message}`);
  }
  if (typeof email !== "string" || !PLAIN_ADDRESS.test(email)) throw new ReviewError("the account email is not a plain address");
  const cwd = mkdtempSync(resolve(tmpdir(), "blind-check-"));
  try {
    const obj = await runAndParse(run, commandArgs(ECHO_QUESTION, ECHO_QUESTION), { cwd, timeoutMs: BLIND_TIMEOUT_MS });
    if (typeof obj.result !== "string") throw new ReviewError("blindness answer has no text result");
    const answer = obj.result;
    const rest = maskAccountEmail(answer, email);
    const blind = scanText(rest, rules).length === 0 && !markers.some((m) => m.test(rest));
    return { blind, answer };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function toFindings(obj, dir) {
  const payload = obj.structured_output;
  if (!payload || !Array.isArray(payload.findings)) throw new ReviewError("reviewer output has no findings list");
  const root = resolve(dir);
  const real = realpathSync(dir); // macOS temp folders sit behind a symlink, so the reviewer may report the real path
  const within = (base, file) => {
    const rel = relative(base, resolve(base, file));
    return rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? null : rel;
  };
  return payload.findings.map((f, i) => {
    if (!f || typeof f !== "object") throw new ReviewError(`finding ${i} is not an object`);
    const { file, line, why } = f;
    if (typeof file !== "string" || file === "") throw new ReviewError(`finding ${i} has no file`);
    if (!Number.isInteger(line) || line < 1) throw new ReviewError(`finding ${i} has a bad line: ${line}`);
    if (typeof why !== "string") throw new ReviewError(`finding ${i} has no why`);
    const rel = within(root, file) ?? within(real, file);
    if (rel === null) throw new ReviewError(`finding ${i} names a file outside the folder: ${file}`);
    return { file: rel.split(sep).join("/"), line, why };
  });
}

const SKIP_DIRS = new Set([".git", "node_modules"]);

/** True when a NUL byte sits in the first 8000 bytes. */
function isBinary(path) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(8000);
    return buf.subarray(0, readSync(fd, buf, 0, 8000, 0)).includes(0);
  } finally {
    closeSync(fd);
  }
}

/** Every text file under dir as sorted POSIX relative paths, found by our code. The reviewer's Glob and
 *  Grep may skip dotfiles or honor ignore files, so the review prompt lists the files itself.
 *  Skips .git/ and node_modules/ and binary files. A symlink or an odd file name throws (fail closed). */
export function listTextFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(p);
      } else if (e.isFile()) {
        if (isBinary(p)) continue;
        const rel = relative(dir, p).split(sep).join("/");
        if (/[\r\n]/.test(rel)) throw new ReviewError(`a file name holds a line break: ${JSON.stringify(rel)}`);
        out.push(rel);
      } else {
        throw new ReviewError(`not a plain file or folder, so it cannot be reviewed: ${relative(dir, p)}`);
      }
    }
  };
  walk(dir);
  return out.sort();
}

/** The blind reviewer reads every text file in dir, in batches of `batchSize` files, a few calls at a time.
 *  Returns Finding[] ({ file, line, why }). Any failed batch fails the whole review. */
export async function blindReview(dir, run = runClaude, { batchSize = REVIEW_BATCH } = {}) {
  const policy = readFileSync(POLICY_PATH, "utf8");
  const files = listTextFiles(dir);
  if (files.length === 0) throw new ReviewError("the folder holds no text files to review");
  const batches = [];
  for (let i = 0; i < files.length; i += batchSize) batches.push(files.slice(i, i + batchSize));
  const reviewBatch = async (batch) => {
    const prompt = [
      "Review every text file listed below and return the findings.",
      "Use Read on each listed file. Do not rely on Glob or Grep to find files. Do not skip a file.",
      "",
      "Files:",
      ...batch,
    ].join("\n");
    const obj = await runAndParse(run, commandArgs(prompt, policy, FINDINGS_SCHEMA), { cwd: dir, timeoutMs: REVIEW_TIMEOUT_MS });
    return toFindings(obj, dir);
  };
  const results = new Array(batches.length);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const i = next++;
      results[i] = await reviewBatch(batches[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(REVIEW_PARALLEL, batches.length) }, worker));
  return results.flat();
}
