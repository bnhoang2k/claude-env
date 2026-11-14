#!/usr/bin/env node
// Behaviour tests for the steal-mechanism capture tools (plugins/motion/skills/steal-mechanism/scripts/capture).
// usage: node tests/capture/run.mjs
// Needs ffmpeg, the tools' npm packages and Chromium; without them it prints one `skip: needs ...` line and
// exits 0, so `npm test` still runs on a machine without them. Prints PASS/FAIL per test; exit 1 on any FAIL.
// Each test guards one bug class found in the 2026-11-13 before/after run:
//   frames-ffmpeg9      the frame cutter used -vsync, which ffmpeg 7+ removed
//   track-after-page    the tracker sampled before the page's own frame callbacks, so JS motion read a frame late
//   pre-js-load         --pre-js and --pre-hover were silently skipped with --trigger load
//   compare-missing     easing --compare-track crashed when the other track lacked the selector
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAP = path.join(ROOT, "plugins/motion/skills/steal-mechanism/scripts/capture");
const RUN = path.join(CAP, "run.mjs");

const ffmpegOk = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
const pkgsOk = ["playwright", "pixelmatch", "pngjs"].every((p) => existsSync(path.join(CAP, "node_modules", p)));
if (!ffmpegOk || !pkgsOk) {
  console.log(`skip: needs ${!ffmpegOk ? "ffmpeg" : `npm install in ${CAP}`} to run the capture tool tests`);
  process.exit(0);
}

// Only this run's own temp folder is ever deleted.
const TMP = mkdtempSync(path.join(tmpdir(), "capture-tests-"));
let fails = 0;
const tool = (...args) => spawnSync(process.execPath, [RUN, ...args], { encoding: "utf8", timeout: 300000 });
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ": " + detail : ""}`);
  if (!ok) fails++;
};
const noStack = (s) => !/^\s+at .*:\d+/m.test(s) && !/ERR_MODULE_NOT_FOUND/.test(s);

try {
  // ---- frames-ffmpeg9: a 1 s test clip cut at 10 fps gives 10 or 11 frames on the installed ffmpeg ----
  const clip = path.join(TMP, "clip.mp4");
  spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=1:size=64x64:rate=30", "-pix_fmt", "yuv420p", clip]);
  const fr = tool("frames", "--in", clip, "--out", path.join(TMP, "frames"), "--fps", "10");
  const n = existsSync(path.join(TMP, "frames")) ? readdirSync(path.join(TMP, "frames")).filter((f) => f.endsWith(".png")).length : 0;
  check("frames-ffmpeg9", fr.status === 0 && n >= 10 && n <= 11, `exit ${fr.status}, ${n} frames${fr.status ? ", " + (fr.stderr || fr.stdout).trim().split("\n").pop() : ""}`);

  // ---- track-after-page: a JS-driven box that copies a CSS animation's time must read the same as the CSS box ----
  // The CSS box moves 0 to 300 px over 3 s, linear: 1.67 px per frame at 60 fps. The JS box sets its own transform
  // in a frame callback from that animation's currentTime, so after the page's callbacks both sit at the same x.
  const page = path.join(TMP, "lag.html");
  writeFileSync(page, `<!doctype html><meta charset=utf-8><style>
body{margin:0} .b{position:absolute;top:0;left:0;width:40px;height:40px;background:#888}
#css{animation:go 3000ms linear forwards} #js{top:60px} @keyframes go{to{transform:translateX(300px)}}</style>
<div class=b id=css></div><div class=b id=js></div><script>
const css=document.getElementById('css'), js=document.getElementById('js');
function f(){const a=css.getAnimations()[0]; if(a) js.style.transform='translateX('+(a.currentTime/10)+'px)'; requestAnimationFrame(f)}
requestAnimationFrame(f)</script>`);
  for (const clock of ["virtual", "real"]) {
    const out = path.join(TMP, "lag-" + clock);
    const args = ["capture", "--url", page, "--out", out, "--viewport", "400x120", "--duration", "1500", "--track", "#css, #js", "--no-video"];
    if (clock === "virtual") args.push("--clock", "virtual");
    const r = tool(...args);
    let worst = NaN, count = 0, dupes = 0;
    if (r.status === 0) {
      const t = JSON.parse(readFileSync(path.join(out, "track.json"), "utf8"));
      // One sample per frame: a sampler that re-registers twice piles up samples at the same time.
      dupes = t.samples.length - new Set(t.samples.map((s) => s.t)).size;
      const tx = (e) => { const m = /matrix\(([^)]+)\)/.exec(e?.transform || ""); return m ? Number(m[1].split(",")[4]) : 0; };
      const moving = t.samples.filter((s) => s.els["#css"] && s.els["#js"] && tx(s.els["#css"]) > 5 && tx(s.els["#css"]) < 290);
      count = moving.length;
      worst = Math.max(...moving.map((s) => Math.abs(tx(s.els["#css"]) - tx(s.els["#js"]))));
    }
    // One frame of lag is 1.67 px; anything under 0.5 px means the sample was taken after the page's callback.
    check(`track-after-page (${clock} clock)`, r.status === 0 && count >= 20 && count <= 120 && dupes <= 1 && worst < 0.5,
      r.status ? `exit ${r.status}: ${(r.stderr || r.stdout).trim().split("\n").pop()}` : `${count} moving samples, ${dupes} at a repeated time, worst CSS vs JS gap ${worst.toFixed(2)} px (one frame is 1.67 px)`);
  }

  // ---- pre-js-load: --pre-js with --trigger load must stop with a message, never be skipped ----
  const pj = tool("capture", "--url", page, "--out", path.join(TMP, "prejs"), "--trigger", "load", "--pre-js", "window.x=1", "--no-video", "--duration", "200");
  const pjOut = (pj.stdout + pj.stderr).trim();
  check("pre-js-load", pj.status !== 0 && /--trigger none/.test(pjOut) && noStack(pjOut) && pjOut.split("\n").length <= 2,
    `exit ${pj.status}: ${pjOut.split("\n").slice(-1)[0]}`);

  // ---- compare-missing: a selector absent from the other track is one plain line, and --compare-selector maps it ----
  const mk = (sel, k) => ({ selectors: [sel], samples: Array.from({ length: 30 }, (_, i) => ({ t: i * 16.7, els: { [sel]: { x: 0, y: k * i, w: 10, h: 10, opacity: 1, transform: "none" } } })) });
  writeFileSync(path.join(TMP, "a.json"), JSON.stringify(mk(".a", 2)));
  writeFileSync(path.join(TMP, "b.json"), JSON.stringify(mk(".b", 2)));
  const cm = tool("easing", "--track", path.join(TMP, "a.json"), "--selector", ".a", "--prop", "y", "--compare-track", path.join(TMP, "b.json"));
  const cmOut = (cm.stdout + cm.stderr).trim();
  check("compare-missing: plain error", cm.status !== 0 && noStack(cmOut) && /\.a/.test(cmOut) && /\.b/.test(cmOut),
    `exit ${cm.status}: ${cmOut.split("\n").slice(-1)[0]}`);
  const cs = tool("easing", "--track", path.join(TMP, "a.json"), "--selector", ".a", "--prop", "y", "--compare-track", path.join(TMP, "b.json"), "--compare-selector", ".b");
  let maxDiff = NaN;
  try { maxDiff = JSON.parse(cs.stdout).compare.maxAbsDiff; } catch {}
  check("compare-missing: --compare-selector", cs.status === 0 && maxDiff === 0, `exit ${cs.status}, maxAbsDiff ${maxDiff}`);
} finally {
  rmSync(TMP, { recursive: true, force: true });
}
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
