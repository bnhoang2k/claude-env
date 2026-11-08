// The rebuild's own error against trace.json: seeks the page at every trace row with the trace input
// and reports, per channel, the largest and rms difference and where the largest falls. With --write,
// sets rebuildError (rounded up to 4 significant digits) and tolerance = max(2 x rebuildError, unit
// floor) in the trace file, which is the rule checkTrace enforces.
// usage: node rebuild-error.ts <page.html> <trace.json> [--write]
import { readFileSync, writeFileSync } from "node:fs";
// @ts-ignore: a plain .mjs helper
import { kitImport } from "./kit.mjs";
const { openPage, closeBrowser } = await kitImport("src/gate/harness.ts");
const { toleranceFor } = await kitImport("src/gate/bar-gate.ts");
const [file, traceFile] = process.argv.slice(2);
if (!file || !traceFile) throw new Error("usage: node rebuild-error.ts <page.html> <trace.json> [--write]");
const trace = JSON.parse(readFileSync(traceFile, "utf8"));
const p = await openPage(file, trace.input.kind === "none" ? {} : { input: trace.input.samples });
const frames = await p.framesAt(trace.samples.map((r: number[]) => r[0]));
await p.close(); await closeBrowser();
const up = (x: number) => { if (x === 0) return 0; const s = 10 ** (Math.floor(Math.log10(x)) - 3); return Math.ceil(x / s - 1e-9) * s; };
const report: Record<string, unknown> = {};
trace.channels.forEach((c: { name: string; unit: string; read?: string; rebuildError: number; tolerance: number }, ci: number) => {
  const key = c.read ?? c.name;
  let worst = 0, at = 0, sq = 0, n = 0, missing = 0;
  frames.forEach((f: { ms: number; values: Record<string, number> }, j: number) => {
    const want = trace.samples[j][ci + 1]; if (want === null) return;
    const got = f.values[key];
    if (typeof got !== "number" || !Number.isFinite(got)) { missing++; return; }
    const d = Math.abs(got - want); sq += d * d; n++;
    if (d > worst) { worst = d; at = f.ms; }
  });
  report[c.name] = { worst: +worst.toPrecision(4), atMs: +at.toFixed(1), rms: n ? +Math.sqrt(sq / n).toPrecision(3) : null, rows: n, missing };
  if (process.argv.includes("--write")) { c.rebuildError = +up(worst).toPrecision(4); c.tolerance = +toleranceFor(c.unit, c.rebuildError).toPrecision(6); }
});
console.log(JSON.stringify(report, null, 1));
if (process.argv.includes("--write")) writeFileSync(traceFile, JSON.stringify(trace));
