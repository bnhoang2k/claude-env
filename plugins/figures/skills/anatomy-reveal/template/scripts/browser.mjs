import puppeteer from "puppeteer-core";
import { chromePath } from "./chrome-path.mjs";
// chromePath() lives in chrome-path.mjs, which imports nothing outside node:, so preflight.mjs can use it before `npm install`.
export { chromePath };
export function launch() {
  const args = ["--enable-gpu", "--force-color-profile=srgb"];
  if (process.platform === "darwin") args.push("--use-angle=metal");
  if (process.platform === "linux") args.push("--no-sandbox");
  return puppeteer.launch({ executablePath: chromePath(), headless: true, args });
}
