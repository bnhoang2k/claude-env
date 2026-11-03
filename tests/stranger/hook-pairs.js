// Pairs every shipped hook with the sample payloads in tests/stranger/hook-samples/ that it would receive.
//
// usage: node tests/stranger/hook-pairs.js <samples dir> <plugin dir>...
//
// Reads each plugin's hooks/hooks.json and pairs every hook command with every sample whose event and
// tool (or SessionStart source) match. Prints one tab-separated line per pair,
// `PAIR <label> <plugin dir> <command> <sample>`, and `NOSAMPLE <label>` for a hook with no sample.
// A plugin dir without hooks/hooks.json is skipped. Used by tests/stranger/run.sh (on the installed
// copies) and tests/checks.d/28-hook-samples.sh (on the checkout, so a missing sample fails before a push).
const fs = require("fs"), path = require("path");
const [samplesDir, ...plugins] = process.argv.slice(2);
const samples = fs.readdirSync(samplesDir).filter((n) => n.endsWith(".json")).sort()
  .map((n) => ({ name: n, file: path.join(samplesDir, n), data: JSON.parse(fs.readFileSync(path.join(samplesDir, n), "utf8")) }));

// The plugin's name from its manifest; the folder name is a version number in the installed cache.
function pluginName(dir) {
  const manifest = path.join(dir, ".claude-plugin", "plugin.json");
  if (fs.existsSync(manifest)) return JSON.parse(fs.readFileSync(manifest, "utf8")).name;
  return path.basename(path.dirname(dir));
}

for (const dir of plugins) {
  const file = path.join(dir, "hooks", "hooks.json");
  if (!fs.existsSync(file)) continue;
  const plugin = pluginName(dir);
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
