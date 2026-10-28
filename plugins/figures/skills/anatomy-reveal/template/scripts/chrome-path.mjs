// Finds a Chrome, Chromium or Edge to drive. It imports only from node:, so it loads before `npm install`.
// preflight.mjs uses it for the same reason: it must run on a machine that has installed nothing yet.
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const env = process.env;
export const CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/usr/bin/microsoft-edge",
  ],
  win32: [
    `${env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
};
// Commands looked up on PATH on Linux after the fixed paths above (a distro may install them elsewhere).
const LINUX_COMMANDS = ["google-chrome", "chromium", "chromium-browser"];

function onPath(names) {
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const file = join(dir, name);
      if (existsSync(file)) return file;
    }
  }
  return undefined;
}

/** The browser to drive: CHROME_PATH, else the first candidate that exists. Throws when there is none. */
export function chromePath() {
  const path =
    env.CHROME_PATH ||
    (CANDIDATES[process.platform] ?? []).find((p) => p && !p.startsWith("undefined") && existsSync(p)) ||
    (process.platform === "linux" ? onPath(LINUX_COMMANDS) : undefined);
  if (!path) throw new Error("No Chrome, Chromium or Edge found. Set CHROME_PATH to the browser executable.");
  return path;
}
