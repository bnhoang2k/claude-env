// Each planted fault's own effect on the trace channels: the fault page against the clean page, both
// seeked at every trace row with the trace input, as the largest difference per channel and its ratio
// to the channel's tolerance. Then each fault page through Gate A, with the checks that catch it.
// A fault whose own effect stays under 1 x tolerance on every channel is caught only by luck: make it
// bigger or pick another.
// usage: node fault-effects.ts <bar dir>
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-ignore: a plain .mjs helper
import { kitImport } from "./kit.mjs";
const { openPage, closeBrowser } = await kitImport("src/gate/harness.ts");
const { plantFault, STANDARD_FAULTS, LINEAR_FAULT } = await kitImport("src/gate/faults.ts");
const { barGate } = await kitImport("src/gate/bar-gate.ts");
const dir = process.argv[2];
if (!dir) throw new Error("usage: node fault-effects.ts <bar dir>");
const bar = JSON.parse(readFileSync(path.join(dir, "bar.json"), "utf8"));
const trace = JSON.parse(readFileSync(path.join(dir, "trace.json"), "utf8"));
const html = readFileSync(path.join(dir, "index.html"), "utf8");
const times = trace.samples.map((r: number[]) => r[0]);
const opts = trace.input.kind === "none" ? {} : { input: trace.input.samples };
const seekAll = async (file: string) => { const p = await openPage(file, opts); try { return await p.framesAt(times); } finally { await p.close(); } };
const clean = await seekAll(path.join(dir, "index.html"));
const faults = [...STANDARD_FAULTS, ...bar.faults.filter((f: { name: string }) => f.name !== LINEAR_FAULT).map((f: { name: string }) => ({ own: f.name }))];
let uncaught = 0;
for (const fault of faults) {
  const copy = mkdtempSync(path.join(os.tmpdir(), "fault-"));
  try {
    cpSync(dir, copy, { recursive: true });
    writeFileSync(path.join(copy, "index.html"), plantFault(html, fault, bar));
    const fr = await seekAll(path.join(copy, "index.html"));
    const eff = trace.channels.map((c: { name: string; read?: string; tolerance: number }) => {
      const key = c.read ?? c.name;
      let worst = 0, at = 0;
      fr.forEach((f: { ms: number; values: Record<string, number> }, j: number) => { const d = Math.abs(f.values[key]! - clean[j]!.values[key]!); if (d > worst) { worst = d; at = f.ms; } });
      return `${c.name} ${+worst.toPrecision(4)} at ${at.toFixed(1)} ms (${(worst / c.tolerance).toFixed(2)} x tol)`;
    });
    const v = await barGate(copy);
    if (v.status !== "failed") uncaught++;
    const by = [...new Set(v.failures.map((l: string) => l.slice(0, l.indexOf(":"))))];
    console.log(JSON.stringify(fault), "| own effect:", eff.join("; "));
    console.log("   gate:", v.status, by.join(", "), "|", v.failures.slice(0, 3).join(" || "));
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}
await closeBrowser();
console.log(uncaught === 0 ? "every fault fails Gate A" : `${uncaught} fault(s) NOT caught`);
process.exit(uncaught === 0 ? 0 : 1);
