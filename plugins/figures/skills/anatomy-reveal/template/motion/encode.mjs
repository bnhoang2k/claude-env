import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
const [src = "out/blur", out = "out/film.mp4"] = process.argv.slice(2);
const avg = join(src, "avg");
mkdirSync(avg, { recursive: true });
const groups = new Map();
for (const file of readdirSync(src)) {
  const m = /^b_(\d+)_(\d+)\.png$/.exec(file);
  if (!m) continue;
  if (!groups.has(m[1])) groups.set(m[1], []);
  groups.get(m[1]).push(join(src, file));
}
const keys = [...groups.keys()].sort();
if (!keys.length) {
  console.error(`no sub-frames in ${src}: run node motion/render.mjs blur ${src} first`);
  process.exit(2);
}
// A tool that is missing or cannot run ends the run with one line and exit 3, not a stack trace.
const NEEDS = { magick: "ImageMagick 7 (the magick command)", ffmpeg: "ffmpeg" };
const run = (tool, cmd, args) =>
  new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", (e) => {
      if (e.code !== "ENOENT" && e.code !== "EACCES") return fail(e);
      const why = e.code === "ENOENT" ? "was not found" : "is not an executable file";
      console.error(`needs ${NEEDS[tool]}: \`${cmd}\` ${why}; run node scripts/preflight.mjs for where to get it`);
      process.exit(3);
    });
    p.on("close", (code) => (code ? fail(new Error(`${cmd} exited with ${code}`)) : ok()));
  });
const magick = process.env.MAGICK || "magick";
let next = 0;
const worker = async () => {
  while (next < keys.length) {
    const key = keys[next++];
    const files = groups.get(key).sort();
    const target = join(avg, `f_${key}.png`);
    if (files.length === 1) copyFileSync(files[0], target);
    else await run("magick", magick, [...files, "-evaluate-sequence", "mean", target]);
  }
};
await Promise.all(Array.from({ length: Math.max(2, Math.min(8, cpus().length)) }, worker));
await run("ffmpeg", process.env.FFMPEG || "ffmpeg", [
  "-v",
  "error",
  "-y",
  "-framerate",
  "30",
  "-start_number",
  String(Number(keys[0])),
  "-i",
  join(avg, "f_%04d.png"),
  "-vf",
  "format=yuv420p",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "15",
  "-movflags",
  "+faststart",
  out,
]);
console.log(`wrote ${out} · ${keys.length} frames`);
