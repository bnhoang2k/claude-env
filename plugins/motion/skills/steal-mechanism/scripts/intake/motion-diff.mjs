// Proves a bar kept its numbers: compares the MOTION const of the page that was rebuilt and checked
// (the bar home's <slug>/index.html) with the bar's copy in motion-kit, value by value. Intake may
// add hooks around the motion and add MOTION values the hooks need (a rest snap, the reduced-motion
// still states, trace cuts). A changed or removed value (a rename to a public label, a time-step cap
// fix) is allowed only with a stated reason in the hand-over and the commit, and Gate A must still
// pass after it. Added values print as notes; changed and removed ones exit 1 so none goes unstated.
// usage: node motion-diff.mjs <rebuilt index.html> <bar index.html>     exit 0 kept, 1 changed or removed (state why)
import { readFileSync } from "node:fs";
import { kitImport } from "./kit.mjs";
const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error("usage: node motion-diff.mjs <rebuilt index.html> <bar index.html>"); process.exit(2); }
const { motionRange, evaluateMotion } = await kitImport("src/core/bar.ts");
const motionOf = (f) => { const h = readFileSync(f, "utf8"); const r = motionRange(h); if (!r) throw new Error(`${f}: no const MOTION = {...}`); return evaluateMotion(h.slice(r.start, r.end)); };
const flat = (o, p = "", out = {}) => {
  if (typeof o === "function") out[p] = `fn:${String(o)}`;
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, out);
  else out[p] = o;
  return out;
};
const A = flat(motionOf(a)), B = flat(motionOf(b));
const added = Object.keys(B).filter((k) => !(k in A));
const diffs = Object.keys(A).filter((k) => !Object.is(A[k], B[k]));
for (const k of added) console.log(`added ${k}: ${JSON.stringify(B[k])}`);
for (const k of diffs) console.log(`${k in B ? "CHANGED" : "REMOVED"} ${k}: ${JSON.stringify(A[k])} -> ${JSON.stringify(B[k])}`);
console.log(diffs.length ? `${diffs.length} MOTION value(s) changed or removed` : `MOTION: all ${Object.keys(A).length} values kept, ${added.length} added`);
process.exit(diffs.length ? 1 : 0);
