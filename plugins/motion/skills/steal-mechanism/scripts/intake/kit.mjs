// Where the kit checkout is: $MOTION_KIT, else the folder named motion-kit under $PROJECTS_ROOT. Every intake script
// imports the kit's own gate code from there, so a trace or a fault is judged by the code that ships.
// No home-folder fallback: a guessed path would judge a trace by the wrong checkout.
import path from "node:path";
import { pathToFileURL } from "node:url";
export function kitPath(env = process.env) {
  if (env.MOTION_KIT) return env.MOTION_KIT;
  if (env.PROJECTS_ROOT) return path.join(env.PROJECTS_ROOT, "motion-kit");
  throw new Error("intake needs a motion-kit checkout: set MOTION_KIT");
}
export const KIT = kitPath();
export const kitImport = (rel) => import(pathToFileURL(path.join(KIT, rel)).href);
