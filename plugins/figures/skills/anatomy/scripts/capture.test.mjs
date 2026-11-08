import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execute = promisify(execFile);
const capture = fileURLToPath(new URL("capture.mjs", import.meta.url));

test("capture creates nested output directories for initial and timed screenshots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "anatomy-capture-"));
  try {
    const page = join(directory, "figure.html");
    const output = join(directory, "shots", "closeups", "figure.png");
    await writeFile(page, '<!doctype html><div class="iso-plate" style="width:200px;height:100px;background:papayawhip">Figure</div>');
    const result = await execute(process.execPath, [capture, page, "--out", output, "--wait", "0", "--times", "20", "--scale", "1"], { timeout: 30000 });
    assert.match(result.stdout, /console: clean/);
    for (const name of [output, output.replace(/\.png$/, "-20.png")]) {
      const png = await readFile(name);
      assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.ok(png.length > 100);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("capture retains existing-directory output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "anatomy-capture-"));
  try {
    const page = join(directory, "figure.html");
    const output = join(directory, "figure.png");
    await writeFile(page, '<!doctype html><div class="iso-plate" style="width:200px;height:100px;background:papayawhip">Figure</div>');
    await execute(process.execPath, [capture, page, "--out", output, "--wait", "0"], { timeout: 30000 });
    assert.ok((await readFile(output)).length > 100);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("capture --select html shoots the whole page at full size, from the top", async () => {
  const directory = await mkdtemp(join(tmpdir(), "anatomy-capture-"));
  try {
    const page = join(directory, "tall.html");
    const output = join(directory, "page.png");
    const blocks = ["#fcc", "#cfc", "#ccf", "#ffc"].map((color) => `<div style="height:500px;background:${color}"></div>`).join("");
    await writeFile(page, `<!doctype html><meta name="viewport" content="width=device-width"><style>html,body{margin:0}</style>${blocks}`);
    await execute(process.execPath, [capture, page, "--select", "html", "--width", "400", "--height", "600", "--scale", "2", "--wait", "0", "--out", output], { timeout: 30000 });
    const png = await readFile(output);
    // IHDR: width and height are big-endian at bytes 16 and 20. A clip box padded by 6px or drawn at half size changes them.
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [800, 4000]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
