import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// ANATOMY_DIR: the folder of the figures:anatomy skill (the base directory its Skill call prints).
const A = process.env.ANATOMY_DIR || (() => { throw new Error("set ANATOMY_DIR to the figures:anatomy skill folder"); })();
const k = await import(`${A}/kit/iso-kit.mjs`);
const { kitScript } = await import(`${A}/scripts/inline-kit.mjs`);

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 900, HEIGHT = 464;

// ---------- the real rule, run on the example data ----------
const SUFFIX = new Set(["inc", "llc", "corp", "ltd", "co"]);
const norm = (s) => s.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
const normTitle = (s) => norm(s).join(" ");
const normCompany = (s) => { const t = norm(s); while (t.length > 1 && SUFFIX.has(t[t.length - 1])) t.pop(); return t.join(" "); };
const lcs = (a, b) => { const m = Array(b.length + 1).fill(0); for (const ca of a) { let prev = 0; for (let j = 1; j <= b.length; j++) { const tmp = m[j]; m[j] = ca === b[j - 1] ? prev + 1 : Math.max(m[j], m[j - 1]); prev = tmp; } } return m[b.length]; };
const ratio = (a, b) => (a.length + b.length ? (200 * lcs(a, b)) / (a.length + b.length) : 100);
function tokenSetRatio(a, b) { // rapidfuzz / fuzzywuzzy token_set_ratio
  const A1 = new Set(a.split(" ")), B1 = new Set(b.split(" "));
  const inter = [...A1].filter((t) => B1.has(t)).sort();
  const ab = [...A1].filter((t) => !B1.has(t)).sort(), ba = [...B1].filter((t) => !A1.has(t)).sort();
  if (inter.length && (!ab.length || !ba.length)) return 100;
  const t0 = inter.join(" "), t1 = [t0, ab.join(" ")].filter(Boolean).join(" "), t2 = [t0, ba.join(" ")].filter(Boolean).join(" ");
  return Math.max(ratio(t0, t1), ratio(t0, t2), ratio(t1, t2));
}
const COMPANIES = ["acme", "initech", "globex"];
const SEEN = [ // jobs already in the 7-day window (made-up example)
  { title: "Product Designer", company: "Acme", days: 6 },
  { title: "Software Engineer II", company: "Acme", days: 5 },
  { title: "Backend Engineer", company: "Globex", days: 2 },
];
const BATCH = [ // today's scrape (made-up example)
  { title: "Software Engineer II", company: "Acme, Inc." },
  { title: "Data Analyst", company: "Initech LLC" },
  { title: "Data Analyst", company: "Initech, LLC." },
  { title: "Frontend Engineer", company: "Globex" },
  { title: "Backend Engineer (Remote)", company: "Globex Corp." },
];
const keys = [];
const JOBS = BATCH.map((job) => {
  const t = normTitle(job.title), c = normCompany(job.company), key = `${t}|${c}`;
  const repeatOf = keys.indexOf(key);
  if (repeatOf < 0) keys.push(key);
  const out = { ...job, key, slot: COMPANIES.indexOf(c), peg: repeatOf < 0 ? keys.length - 1 : repeatOf, repeat: repeatOf >= 0 };
  if (!out.repeat) {
    const pool = SEEN.map((s, i) => ({ i, s, score: Math.round(tokenSetRatio(t, normTitle(s.title))) })).filter((m) => normCompany(m.s.company) === c);
    const best = pool.sort((x, y) => y.score - x.score || y.s.days - x.s.days)[0];
    out.match = best ? { seen: best.i, score: best.score, title: best.s.title, days: best.s.days } : null;
    out.drop = !!best && best.score >= 90;
  }
  return out;
});
console.log(JOBS.map((j) => `${j.key} repeat=${j.repeat} match=${j.match ? j.match.score : "-"} drop=${j.drop}`).join("\n"));

// ---------- layout (world units) ----------
const BT = 8;                         // belt top
const CARD = { x: -7, y: -8, w: 14, d: 16, r: 1 }, CARD_H = 1.2;
const BASE = { x: -184, y: -62, w: 334, d: 124, r: 8 };
const BELT = { x: -154, y: -11, w: 222, d: 22, r: 2 };
const HOP = { x: -178, y: -10, w: 24, d: 20, r: 2 };
const SX = -112, G1 = -60, G2 = 8;   // stamp, exact gate, fuzzy gate
const BEAM_Z = 48, HEAD_REST = 24, HEAD_LOW = BT + CARD_H, HEAD_H = 6;
const BIN_Y = 22, BIN_D = 26, WALL = 1.4, WALL_H = 6;
const TRAY_X = 76, TRAY_W = 26, TRAY_D = 22;
const TRAY_Y = [-36, -11, 14];        // acme, initech, globex (plan y of each tray)
const DIAL = [G2, -42], DIAL_R = 14, DIAL_TOP = 26, SPAN = 1.5 * Math.PI, FROM = -0.75 * Math.PI;

const P = k.fitProjection(k.boxCorners(BASE, -8, BEAM_Z + 6), WIDTH, HEIGHT, { pad: 12, azimuth: 58 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const T = (xy, z, text, along = "x", size = 4.6, tone = "mid", anchor = "middle") => k.faceTextSvg(k.topMatrix(xy, z, P, along), text, { size, tone, anchor });

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -8, 8, P)}"/>`];
  out.push(S(k.slabOf(BASE, -8, 8, P, 8, 1.4), { tone: "lo" }));
  const screws = k.corners(BASE, 8);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }), D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // labels printed on the base
  out.push(T([HOP.x + HOP.w / 2, HOP.y + HOP.d + 7], 0, "scraped"));
  out.push(T([G1, BIN_Y + BIN_D + 6], 0, "exact repeat"), T([G2, BIN_Y + BIN_D + 6], 0, "match ≥ 90"));
  out.push(T([TRAY_X + TRAY_W / 2, TRAY_Y[2] + TRAY_D + 6], 0, "last 7 days"));
  COMPANIES.forEach((c, i) => out.push(T([TRAY_X + TRAY_W + 6, TRAY_Y[i] + TRAY_D / 2], 0, c, "y", 4.4)));
  return out.join("");
}
function hopper() { return S(k.slabOf(HOP, 0, BT, P, 4, 0.6), { tone: "mid" }); }
function belt() {
  const out = [S(k.slabOf(BELT, 0, BT, P, 4, 0.6), { tone: "mid" })];
  const seams = [];
  for (let x = BELT.x + 10; x < BELT.x + BELT.w - 4; x += 14) seams.push(k.lineOnTop([x, BELT.y], [x, BELT.y + BELT.d], BT, P));
  out.push(L(seams.join(""), { tone: "faint" }));
  return out.join("");
}
function pegboard() {
  const plan = { x: G1 - 24, y: -50, w: 48, d: 18, r: 2 };
  const out = [S(k.slabOf(plan, 0, 4, P, 4, 0.5), { tone: "mid" })];
  out.push(L([0, 1, 2, 3, 4].map((i) => k.ring(G1 - 16 + i * 8, -41, 2.4, 4, P, 20)).join(""), { tone: "lo" }));
  return out.join("");
}
const pegSvg = (i) => S(k.cylinder(G1 - 16 + i * 8, -41, 2.2, 4, 6, P, 20), { tone: "hi" });
function gauge() {
  const [x, y] = DIAL;
  const out = [S(k.cylinder(x, y, 4, 0, DIAL_TOP - 5, P, 24), { tone: "mid", crease: "none" })];
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_TOP - 5, 5, P, 64, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, DIAL_R - 1.8, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 2.4, 20, 5, DIAL_TOP, [1.2, 2.4], P, FROM, SPAN);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const a90 = FROM + 0.9 * SPAN;
  out.push(L(k.lineOnTop([x + Math.sin(a90) * (DIAL_R - 6), y - Math.cos(a90) * (DIAL_R - 6)], [x + Math.sin(a90) * (DIAL_R - 2.4), y - Math.cos(a90) * (DIAL_R - 2.4)], DIAL_TOP, P), { tone: "hi" }));
  out.push(T([x + Math.sin(a90) * (DIAL_R - 8), y - Math.cos(a90) * (DIAL_R - 8) + 1], DIAL_TOP, "90", "x", 2.6, "hi"));
  out.push(L(k.ring(x, y, 1.4, DIAL_TOP, P, 16), { tone: "mid" }));
  return out.join("");
}
const housing = (gx) => S(k.slabOf({ x: gx - 9, y: -26, w: 18, d: 10, r: 1.5 }, 0, 15, P, 4, 0.5), { tone: "mid" });
const paddleSvg = (gx) => S(k.slabOf({ x: gx - 7, y: -15.5, w: 14, d: 2.4, r: 0.6 }, BT + 0.6, 6, P, 3), { tone: "mid" });
function openBox(plan, part) { // part: "back" (floor + far walls) or "front" (near walls)
  const { x, y, w, d } = plan;
  if (part === "back") return [
    S(k.slabOf({ x, y, w, d, r: 1 }, 0, 1.2, P, 3), { tone: "mid" }),
    S(k.slabOf({ x, y, w, d: WALL, r: 0.4 }, 1.2, WALL_H - 1.2, P, 2), { tone: "mid" }),
    S(k.slabOf({ x, y, w: WALL, d, r: 0.4 }, 1.2, WALL_H - 1.2, P, 2), { tone: "mid" }),
  ].join("");
  return [
    S(k.slabOf({ x: x + w - WALL, y, w: WALL, d, r: 0.4 }, 1.2, WALL_H - 1.2, P, 2), { tone: "mid" }),
    S(k.slabOf({ x, y: y + d - WALL, w, d: WALL, r: 0.4 }, 1.2, WALL_H - 1.2, P, 2), { tone: "mid" }),
  ].join("");
}
const binPlan = (gx) => ({ x: gx - 14, y: BIN_Y, w: 28, d: BIN_D });
const trayPlan = (i) => ({ x: TRAY_X, y: TRAY_Y[i], w: TRAY_W, d: TRAY_D });
function cardSvg() {
  const lines = [3.5, 0.5, -2.5].map((yy, i) => k.lineOnTop([-4.6, yy], [i === 2 ? 0 : 4.6, yy], CARD_H, P)).join("");
  const mark = `<path class="iso-line" data-mark data-tone="lit" style="opacity:0" d="${k.planOutline({ x: 1.6, y: -6.4, w: 3.4, d: 3.4, r: 0.4 }, CARD_H, P, 2)}"/>`;
  return S(k.slabOf(CARD, 0, CARD_H, P, 2), { tone: "hi", crease: "none", inner: L(lines, { tone: "lo", free: true }) + mark });
}
const card = (attrs, pos) => `<g ${attrs} transform="${k.translateAlong(P, pos)}">${cardSvg()}</g>`;
const SEEN_POS = SEEN.map((s, i) => { const slot = COMPANIES.indexOf(normCompany(s.company)); const n = SEEN.slice(0, i).filter((o) => normCompany(o.company) === normCompany(s.company)).length; return [TRAY_X + TRAY_W / 2, TRAY_Y[slot] + TRAY_D / 2, 1.2 + n * 1.4]; });
const hopPos = (i) => [HOP.x + HOP.w / 2, 0, BT + (BATCH.length - 1 - i) * 1.4];

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "A small sorting machine for job cards. Cards leave a hopper on a belt, get a key stamped by a press, pass a pegboard of keys already seen, then a gauge that scores the title against the same company's tray of jobs from the last 7 days. Repeats and close matches are pushed into two bins; the rest are filed in their company's tray.",
  body: [
    base(), pegboard(), `<g data-pegs>${JOBS.map((_, i) => `<g data-peg="${i}" style="opacity:0">${pegSvg(i)}</g>`).join("")}</g>`,
    gauge(), `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d=""/>`,
    housing(G1), housing(G2), hopper(),
    `<g data-part="stamp-back">${S(k.cylinder(SX, -18, 2.4, 0, BEAM_Z, P, 20), { tone: "mid" })}</g>`,
    belt(),
    `<g data-arm="0"></g><g data-paddle="0">${paddleSvg(G1)}</g>`,
    `<g data-arm="1"></g><g data-paddle="1">${paddleSvg(G2)}</g>`,
    ...[G1, G2].map((gx, i) => `${openBox(binPlan(gx), "back")}<g data-bin="${i}"></g>${openBox(binPlan(gx), "front")}`),
    ...COMPANIES.map((_, i) => `${openBox(trayPlan(i), "back")}<g data-tray="${i}">${SEEN.map((s, j) => (SEEN_POS[j] && COMPANIES.indexOf(normCompany(s.company)) === i ? card(`data-seen="${j}"`, SEEN_POS[j]) : "")).join("")}</g>${openBox(trayPlan(i), "front")}`),
    `<g data-transit>${JOBS.map((_, i) => i).reverse().map((i) => card(`data-card="${i}"`, hopPos(i))).join("")}</g>`,
    `<g data-part="head" transform="${k.translateAlong(P, [0, 0, HEAD_REST])}">${S(k.slabOf({ x: SX - 7, y: -8, w: 14, d: 16, r: 1.5 }, 0, HEAD_H, P, 3, 0.5), { tone: "hi", crease: "lo" })}</g>`,
    `<g data-part="rod"></g>`,
    S(k.slabOf({ x: SX - 6, y: -21, w: 12, d: 42, r: 1.5 }, BEAM_Z, 6, P, 3, 0.5), { tone: "mid" }),
    D([at([SX, -14, BEAM_Z + 6]), at([SX, 14, BEAM_Z + 6])], { size: 0.45 }),
    S(k.cylinder(SX, 18, 2.4, 0, BEAM_Z, P, 20), { tone: "mid" }),
  ],
});

const rows = JOBS.map((j, i) => `<li data-row="${i}"><span class="raw">${j.title} · ${j.company}</span><span class="out" data-out></span></li>`).join("");
const body = k.plateHtml({
  fig: "Fig 1", title: "merge_similar",
  hint: "made-up example jobs",
  readout: "",
  caption: "A card's key is its normalized title and company. The pegboard holds every key seen in this batch, so an exact repeat is pushed off first. Survivors are scored against the same company's tray from the last 7 days; a token_set_ratio of 90 or more pushes the new card off and the older one stays.",
  body: `<div class="iso-stage">${svg}</div>`,
}).replace("</figure>", `<ol class="jobs">${rows}</ol></figure>`);

const CSS = `
.jobs{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:2px;font:12px/1.5 var(--anatomy-mono);font-variant-numeric:tabular-nums}
.jobs li{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 16px;padding:5px 10px;color:var(--anatomy-muted);border-radius:6px;transition:color .25s,background-color .25s}
.jobs li[data-on]{color:var(--anatomy-strong);background:var(--anatomy-card)}
.jobs .out{color:inherit;opacity:.85}
.iso-plate{padding:40px 8px}.iso-plate-corner[data-corner="readout"]{max-width:calc(100% - 150px);overflow:hidden;text-overflow:ellipsis}
[data-peg],[data-mark]{transition:opacity .3s}
`;

const live = `
const P = ${JSON.stringify(P)};
const JOBS = ${JSON.stringify(JOBS)};
const C = ${JSON.stringify({ BT, SX, G1, G2, HEAD_REST, HEAD_LOW, HEAD_H, BEAM_Z, BIN_Y, BIN_D, TRAY_X, TRAY_W, TRAY_D, TRAY_Y, DIAL, DIAL_R, DIAL_TOP, SPAN, FROM, BELT_END: BELT.x + BELT.w, CARD_H })};
const HOP = ${JSON.stringify(BATCH.map((_, i) => hopPos(i)))};
const COMPANIES = ${JSON.stringify(COMPANIES)};
const svg = document.querySelector(".iso-stage svg");
const $ = (s) => svg.querySelector(s);
const head = $('[data-part="head"]'), rod = $('[data-part="rod"]'), needle = $('[data-part="needle"]');
const readout = document.querySelector("[data-readout]");
const rowsEl = [...document.querySelectorAll("[data-row]")];
const transit = $("[data-transit]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

// one card's script: a list of beats {dur, pose(t) -> {pos, head, kick, needle}, enter, label}
function beats(i) {
  const j = JOBS[i], out = [];
  const start = HOP[i];
  const onBelt = (x) => [x, 0, C.BT];
  out.push({ dur: 1.0, label: "fed in", pose: (t) => { const p = lerp3(start, onBelt(C.SX), ease(t)); p[2] = t < 0.3 ? lerp(start[2], C.BT, ease(t / 0.3)) : C.BT; if (t < 0.3) p[0] = lerp(start[0], start[0] + 18, t / 0.3); else p[0] = lerp(start[0] + 18, C.SX, ease((t - 0.3) / 0.7)); return { pos: p }; } });
  out.push({ dur: 0.8, label: "stamp", enter: () => {}, pose: (t) => { const s = Math.sin(Math.min(1, t) * Math.PI); if (t > 0.5) mark(i, 1); return { pos: onBelt(C.SX), head: lerp(C.HEAD_REST, C.HEAD_LOW, s) }; }, say: "key " + j.key });
  out.push({ dur: 0.8, pose: (t) => ({ pos: onBelt(lerp(C.SX, C.G1, ease(t))) }), say: "key " + j.key });
  out.push({ dur: 0.7, enter: () => { peg(j.peg, j.repeat ? "lit" : "on"); }, pose: () => ({ pos: onBelt(C.G1) }), say: j.repeat ? "key already on the pegboard" : "new key, peg added" });
  if (j.repeat) { out.push(kick(i, 0, C.G1, "dropped: exact repeat")); return out; }
  out.push({ dur: 0.8, enter: () => peg(j.peg, "on"), pose: (t) => ({ pos: onBelt(lerp(C.G1, C.G2, ease(t))) }) });
  const score = j.match ? j.match.score : 0;
  const cmp = j.match ? "vs \\u201c" + j.match.title + "\\u201d (" + j.match.days + "d ago): " + score : "no " + COMPANIES[j.slot] + " jobs in 7 days";
  out.push({ dur: 1.2, enter: () => j.match && seenLit(j.match.seen, true), pose: (t) => ({ pos: onBelt(C.G2), needle: score * ease(Math.min(1, t / 0.7)) }), say: cmp });
  if (j.drop) { out.push(kick(i, 1, C.G2, "dropped: " + score + " \\u2265 90, older kept", () => seenLit(j.match.seen, false))); return out; }
  const tray = [C.TRAY_X + C.TRAY_W / 2, C.TRAY_Y[j.slot] + C.TRAY_D / 2];
  const stack = () => 1.2 + (svg.querySelector('[data-tray="' + j.slot + '"]').children.length) * 1.4;
  let floor = 1.2;
  out.push({ dur: 1.0, enter: () => j.match && seenLit(j.match.seen, false), pose: (t) => ({ pos: onBelt(lerp(C.G2, tray[0], ease(t))), needle: score * (1 - ease(t)) }), say: (j.match ? score + " < 90" : "nothing to match") + ", kept" });
  out.push({ dur: 0.6, pose: (t) => ({ pos: [tray[0], lerp(0, tray[1], ease(t)), C.BT] }) });
  out.push({ dur: 0.5, enter: () => { floor = stack(); svg.querySelector('[data-tray="' + j.slot + '"]').appendChild(card(i)); }, pose: (t) => ({ pos: [tray[0], tray[1], lerp(C.BT, floor, ease(t))] }), done: "kept, filed under " + COMPANIES[j.slot] });
  return out;
}
function kick(i, which, gx, text, after) {
  let floor = 1.2;
  return { dur: 1.1, say: text, done: text, enter: () => { floor = 1.2 + svg.querySelector('[data-bin="' + which + '"]').children.length * 1.4; after && after(); },
    pose: (t) => {
      const push = t < 0.5 ? ease(t / 0.5) : 1 - ease((t - 0.5) / 0.5);
      const y = lerp(0, C.BIN_Y + C.BIN_D / 2, ease(Math.min(1, t / 0.75)));
      const fall = Math.max(0, (y - 11) / (C.BIN_Y + C.BIN_D / 2 - 11));
      if (y > C.BIN_Y && card(i).parentNode !== svg.querySelector('[data-bin="' + which + '"]')) svg.querySelector('[data-bin="' + which + '"]').appendChild(card(i));
      return { pos: [gx, y, lerp(C.BT, floor, fall * fall)], kick: [which, push * 22] };
    } };
}
const card = (i) => svg.querySelector('[data-card="' + i + '"]');
const mark = (i, on) => { card(i).querySelector("[data-mark]").style.opacity = on; };
const peg = (n, state) => { const g = svg.querySelector('[data-peg="' + n + '"]'); g.style.opacity = state === "off" ? 0 : 1; const s = g.querySelector(".iso-solid"); s.toggleAttribute("data-lit", state === "lit"); s.querySelector(".iso-edge").setAttribute("data-tone", state === "lit" ? "lit" : "hi"); };
const seenLit = (n, on) => { const s = svg.querySelector('[data-seen="' + n + '"] .iso-solid'); s.toggleAttribute("data-lit", on); s.querySelector(".iso-edge").setAttribute("data-tone", on ? "lit" : "hi"); };
const cardLit = (i, on) => { const s = card(i).querySelector(".iso-solid"); s.toggleAttribute("data-lit", on); s.querySelector(".iso-edge").setAttribute("data-tone", on ? "lit" : "hi"); };
function needleAt(score) {
  const a = C.FROM + (score / 100) * C.SPAN, [x, y] = C.DIAL;
  return lineOnTop([x - Math.sin(a) * 3, y + Math.cos(a) * 3], [x + Math.sin(a) * (C.DIAL_R - 4), y - Math.cos(a) * (C.DIAL_R - 4)], C.DIAL_TOP + 0.2, P);
}
function setHead(z) {
  head.setAttribute("transform", translateAlong(P, [0, 0, z]));
  rod.innerHTML = solidSvg(cylinder(C.SX, 0, 1.4, z + C.HEAD_H, C.BEAM_Z - z - C.HEAD_H, P, 16), { tone: "mid", crease: "none" });
}
const arms = [0, 1].map((w) => svg.querySelector('[data-arm="' + w + '"]')), paddles = [0, 1].map((w) => svg.querySelector('[data-paddle="' + w + '"]'));
function setKick(w, e) {
  const gx = w ? C.G2 : C.G1;
  paddles[w].setAttribute("transform", translateAlong(P, [0, e, 0]));
  arms[w].innerHTML = solidSvg(slabOf({ x: gx - 1.6, y: -16.2, w: 3.2, d: e + 1, r: 0.4 }, C.BT + 2.6, 2, P, 2), { tone: "mid", crease: "none" });
}
function row(i, text, on) { const r = rowsEl[i]; r.toggleAttribute("data-on", on); if (text !== undefined) r.querySelector("[data-out]").textContent = text; }

const script = JOBS.map((_, i) => beats(i));
let ci = 0, bi = 0, bt = 0, pause = 0, last = 0, frame = 0, visible = false, entered = false;
function reset() {
  JOBS.forEach((_, i) => { const c = card(i); transit.prepend(c); c.setAttribute("transform", translateAlong(P, HOP[i])); mark(i, 0); cardLit(i, false); row(i, "", false); });
  // keep hopper order: card 0 last (on top)
  JOBS.map((_, i) => i).reverse().forEach((i) => transit.appendChild(card(i)));
  JOBS.forEach((_, n) => peg(n, "off"));
  setHead(C.HEAD_REST); setKick(0, 0); setKick(1, 0); needle.setAttribute("d", needleAt(0));
  ci = 0; bi = 0; bt = 0; entered = false; readout.textContent = "";
}
function step(dt) {
  if (pause > 0) { pause -= dt; if (pause <= 0 && ci >= JOBS.length) { svg.style.opacity = 0; setTimeout(() => { reset(); svg.style.opacity = 1; }, 350); pause = 0.6; } return; }
  if (ci >= JOBS.length) return;
  const list = script[ci], b = list[bi];
  if (!entered) { entered = true; b.enter && b.enter(); if (bi === 0) { cardLit(ci, true); row(ci, "", true); } if (b.say) readout.textContent = "job " + (ci + 1) + " \\u00b7 " + b.say; }
  bt += dt;
  const t = Math.min(1, bt / b.dur), pose = b.pose(t);
  card(ci).setAttribute("transform", translateAlong(P, pose.pos));
  setHead(pose.head ?? C.HEAD_REST);
  if (pose.kick) setKick(pose.kick[0], pose.kick[1]);
  if (pose.needle !== undefined) needle.setAttribute("d", needleAt(pose.needle));
  if (t >= 1) {
    if (b.done) { row(ci, b.done, true); }
    bi++; bt = 0; entered = false;
    if (bi >= list.length) { cardLit(ci, false); row(ci, undefined, false); ci++; bi = 0; pause = ci >= JOBS.length ? 3 : 0.4; }
  }
}
function finalState() { // reduced motion: show where every card ends up
  reset();
  JOBS.forEach((j, i) => { mark(i, 1); peg(j.peg, "on"); });
  for (ci = 0; ci < JOBS.length; ci++) { for (const b of script[ci]) { b.enter && b.enter(); const p = b.pose(1); card(ci).setAttribute("transform", translateAlong(P, p.pos)); if (b.done) row(ci, b.done, false); } }
  JOBS.forEach((j) => j.match && seenLit(j.match.seen, false));
  setHead(C.HEAD_REST); setKick(0, 0); setKick(1, 0); needle.setAttribute("d", needleAt(0));
  readout.textContent = "2 kept \\u00b7 1 exact repeat \\u00b7 2 fuzzy matches";
}
svg.style.transition = "opacity .35s";
function tick(now) { const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60; last = now; step(dt); frame = visible ? requestAnimationFrame(tick) : 0; }
reset();
if (still.matches) finalState();
else new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible && !frame) { last = 0; frame = requestAnimationFrame(tick); } }).observe(svg);
`;

writeFileSync(join(HERE, "dedup.html"), k.pageHtml({ title: "Dedup machine", theme: "light", width: 960, body, script: kitScript() + live }).replace("</style>", CSS + "</style>"));
console.log("wrote dedup.html");
