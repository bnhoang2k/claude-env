export const meta = {
  name: 'steal-mechanism',
  description: 'Study and rebuild bar references, fix bar pages the user graded Close, or carry graded pages into motion-kit as bars',
  phases: [
    { title: 'Study', detail: 'study mode: measure every transition of the original' },
    { title: 'Refute', detail: 'study mode: re-measure the study from the frames' },
    { title: 'Build', detail: 'study mode: rebuild the mechanism as a single-file bar page' },
    { title: 'Fix', detail: "fix mode: diagnose and fix what the user's note says is wrong" },
    { title: 'Match', detail: 'capture the imitation, compare side by side, fix while tries are left' },
    { title: 'Intake', detail: 'intake mode: copy a graded page into motion-kit bars/, add hooks, trace the original, write bar.json' },
    { title: 'Check', detail: 'intake mode: re-measure the trace from the original and check the bar folder' },
  ],
}

// TIERS:
// Study -> opus (reasoning: decides what the transitions are and measures them from frames)
// Refute -> opus (reasoning: re-measures and corrects the study; a weak refuter blesses wrong timings silently)
// Build -> sonnet (mechanical: standard implementation from a verified written spec; Match catches gaps)
// Fix -> opus (reasoning: decides whether the study or the build misread the original, then fixes it)
// Match -> opus (reasoning: judges whether the imitation matches frame by frame and fixes it)
// Intake -> opus (reasoning: measures the original into trace.json, adds seek hooks, picks dials and faults)
// Check -> opus (reasoning: refutes the trace against the original frames; a weak checker blesses a rebuild-traced trace)
//
// Worst case per reference: study mode 3 opus + 1 sonnet = 3.5 units, 4 agents; intake lean mode 1 opus = 1 unit, 1 agent;
// fix mode 2 opus = 2 units, 2 agents; intake mode 2 opus = 2 units, 2 agents.
// Each stage runs at most WAVE references at once, so a stage stays at 8 units or fewer.
//
// args: the output of `node <root>/workflows/args.mjs '<json>'`. That command resolves the paths in Node,
//       because this script has no filesystem and no process.env. The JSON you give it:
//       { mode: 'study' | 'fix' | 'intake', slugs: ['<slug>', ...] }  slugs required; mode defaults to 'study'.
//       The output adds: root (this skill's folder), barHome (--barHome, else $STEAL_BAR_HOME, else
//       <cwd>/.steal-mechanism/bars), kit (--kit, else $MOTION_KIT, else null; intake mode needs it),
//       captures (~/.claude/taste/captures), tools (folder with capture.mjs and drive.mjs, or null), spec (args.spec, else
//       $MOTION_KIT_SPEC, else the intake.md that ships beside SKILL.md). Intake mode also gets kitBars (the folders under
//       <kit>/bars/), kitDoc (the kit's CLAUDE.md or AGENTS.md, or null) and kitDialSet (true when the kit keeps
//       kinds/*/dial-set.json) and kitStripsPrivate (true when the kit has scripts/check-public.mjs), so this script names no kit file the kit lacks.
//       Each slug must be an entry in <barHome>/refs.json; in fix mode it must also be graded close in reviews.json;
//       in intake mode, graded pass (or close for assets only) and not yet in <kit>/bars/.
//       { wave, portBase }  optional overrides
//       intake mode only: briefs: { '<slug>': '<settled driver finding>' } and note: '<finding for every bar>',
//       sent to both the Intake and Check agents.

if (!args || !Array.isArray(args.slugs) || args.slugs.length === 0) {
  throw new Error('args.slugs is required: a list of slugs from refs.json')
}
const MODE = args.mode || 'study'
if (!['study', 'fix', 'intake'].includes(MODE)) throw new Error(`args.mode must be "study", "fix" or "intake", got "${MODE}"`)

// The paths arrive resolved (see args above). A launch that skipped args.mjs fails here with the fix.
for (const k of ['root', 'barHome', 'captures']) {
  if (typeof args[k] !== 'string' || !args[k].startsWith('/')) {
    throw new Error(`args.${k} is missing: run \`node <skill folder>/workflows/args.mjs '<json>'\` and pass its output as the workflow args`)
  }
}
if (MODE === 'intake' && !args.kit) throw new Error('intake needs a motion-kit checkout: clone https://github.com/bnhoang2k/motion-kit and set MOTION_KIT to it')
const WAVE = Math.min(args.wave || 8, 8)
const PORT = args.portBase || 9400
const KIT = args.kit ? args.kit.replace(/\/+$/, '') : null
const BAR = args.barHome.replace(/\/+$/, '')
const REFS = BAR + '/refs.json'
const BRIEFS = args.briefs || {}
const NOTE = args.note || ''
// lean: one Intake agent per bar, no Check stage, and a short reading list (one finished bar of the same kind).
const LEAN = MODE === 'intake' && args.lean === true
const SKILL = args.root.replace(/\/+$/, '')
// Original captures of other people's sites: the user's private folder, never a project.
const CAPTURES = args.captures.replace(/\/+$/, '')
// compare.json's original_video: through the review page's link folder when one is set, else absolute.
const LINK = args.capturesLink ? args.capturesLink.replace(/\/+$/, '') : ''
const ORIGINAL_VIDEO = LINK
  ? `${LINK}/<slug>/original/<file name of the original video>`
  : `<absolute path of the original video under ${CAPTURES}/<slug>/original/>`
const SPEC = args.spec || ''
// args.spec is always set by args.mjs (the shipped intake.md unless overridden); the fallback covers a launch that skipped it.
const SPEC_REF = SPEC ? `the intake procedure ${SPEC}` : `the shipped intake.md (${SKILL}/intake.md)`
// The kit files the intake prompts name. Only files the kit has: args.mjs lists them, and with no list the agent runs ls.
const KIT_BARS = Array.isArray(args.kitBars) ? args.kitBars : []
const KIT_DOC = args.kitDoc || 'README.md'
const KIT_DIAL_SET = args.kitDialSet === true
// One rule for the private files, worded the same in SKILL.md and intake.md: a kit with scripts/check-public.mjs is a
// private dev kit that strips them at publish, so they are committed; any other kit is a public clone or fork.
const KIT_STRIPS_PRIVATE = args.kitStripsPrivate === true
const PRIVATE_RULE = KIT_STRIPS_PRIVATE
  ? 'study.md and bar.private.json are private but are still committed: this kit has scripts/check-public.mjs, which strips them at publish.'
  : 'study.md and bar.private.json are private. This kit has no scripts/check-public.mjs, so it is a public clone or fork: the driver keeps both untracked (it adds them to the clone\'s .git/info/exclude) and leaves them out of the bar commit.'
const TOOLS_LINE = args.tools
  ? `${args.tools}/capture.mjs (headless page capture: frames, video, motion curve; read its header) and ${args.tools}/drive.mjs (headless session you steer: click, drag, hold, draw, scroll, records video; read its header)`
  : 'no capture tools folder is configured, so write your own small headless-Chrome capture script in your scratch folder (frames, video, motion curve) and keep it with your notes'

const CONTEXT = `
CONTEXT. motion-kit is a collection of BAR PAGES: single-file pages, each rebuilt from one reference the user liked, that a future builder copies whole. Each reference is studied, rebuilt and match-checked. The user compares the original and the imitation side by side to judge whether the copy is correct. Exact transitions matter more than anything else: timing, order, easing shape, distances, overlap, settle.
`
const RULES = `
STANDING RULES (scoped):
- Truth: every number comes from a capture or file you opened in this run, with its path. Never claim a match you did not measure. If you cannot capture something, say so and why.
- Write only inside your own folder ${BAR}/<slug>/ and, for original captures, ${CAPTURES}/<slug>/ (outside every project). If you must put a capture inside a project folder, first run node ${SKILL}/scripts/ignore-capture.mjs <project folder> <capture path>, which appends the path to that folder's ignore file. Never touch any other bar page folder${KIT ? ' or anything under ' + KIT : ''}. Never commit.
- Disk is tight. Put extracted frames and scratch under <folder>/capture/tmp/ and delete that tmp folder before you return. Keep only deliverables: study.md, trace-original.json, index.html, notes.md, compare.json, capture/side-by-side.mp4, capture/strip.jpg, and the original video plus key frames. Extract only the frame spans you measure, not whole videos at full rate.
- Captures are local reference only. Never publish them, never upload them anywhere.
- Rebuild the MECHANISM, not the brand: no logos, brand names, real copy text, photos or any asset downloaded from the source site. Draw shapes and content in code with neutral placeholder content. Match the composition, motion and timing closely.
- Tools: ${TOOLS_LINE}. Use the port given below for drive.mjs and always send "close" when done. Find ffmpeg with command -v ffmpeg. Do not use the Playwright MCP browser tools: other agents run at the same time and would fight over one browser.
- Every command runs in the FOREGROUND with an explicit timeout up to 600000 ms. No run_in_background.
- Never Read a file over 800 lines whole.
- Plain words in every doc. No em dashes, en dashes or arrows.
`
const refPrompt = (slug, k) => `Your bar reference is the entry with slug "${slug}" in ${REFS}: read it with node. It may have n, slug, group, mechanism, pattern, url, stars, study (an existing deep study path or null), note (the user's words), knobs, members (other pages with the same mechanism) and section (evidence text). Missing fields are fine. Your folder is ${BAR}/${slug}/ (create it if missing). drive.mjs ports for you: ${PORT + k * 2} and ${PORT + k * 2 + 1}.`

const STUDY_FORMAT = `
Write <folder>/study.md with these sections: Source (url, stars, the user's note, which captures you used with paths); Input (exactly what drives the motion: scroll distance, pointer path, drag, hold, tap, timer, load); Timeline (a table, one row per transition: start ms, end ms, what moves, from and to values in px, deg, scale or opacity, easing shape such as linear, ease-out, spring with or without overshoot, and overlap with other rows); Key frames (the timestamps and frame image paths that show each state); Paint (what is effect or surface rather than motion: shaders, glow, grain, blur, sheen); Feel (tempo, rest-to-motion ratio, how landings settle, loop period if any); Viewport (width, height, device shape); Drive script (the drive.mjs actions, or capture.mjs flags, that reproduce the interaction on a page, with timing); Open questions.
Also write <folder>/trace-original.json, measured from the ORIGINAL capture only, never from a rebuild: {"fps": <frame rate you sampled at>, "input": {"kind": "pointer|scroll|key|timer|load", "samples": [[ms, x, y] or [ms, scrollY] or [ms, key], ...]}, "channels": [{"name", "unit", "what": "which element and property"}], "samples": [[ms, v1, v2, ...], ...], "events": {"<name>": ms}}. "channels" holds 2 to 5 entries, never more: pick the ones that carry the mechanism (a position, a scale, an opacity, a loop phase) and put any others in study.md instead. Leave out any channel the capture cannot show. Sample at 60 fps when the original allows it; when the source itself is slower, sample at its own rate and set "fps" to that rate. Input samples come from the drive script you used or from the capture log.
Also save the original as a video plus key frames under ${CAPTURES}/<slug>/original/ (original.webm or .mp4, and frames/). For a 60fps.design or mobbin entry, the original is a video clip: check ${CAPTURES}/ for a clip you saved earlier, else fetch the clip from the page. For a live site, capture it with capture.mjs or drive.mjs.
Measure timings from frames: extract frames with ffmpeg at 30 fps or more and find the first and last frame of each change.`

const ok = (x) => x && typeof x === 'object'
const VERDICT = { type: 'object', properties: {
  slug: { type: 'string' },
  verdict: { type: 'string', enum: ['match', 'close', 'gap', 'blocked'] },
  summary: { type: 'string', description: 'One or two plain sentences' },
  remaining_gaps: { type: 'array', items: { type: 'string' } },
  tries: { type: 'integer' },
  note_addressed: { type: 'boolean', description: 'Fix mode only: whether the user\'s note is now true of the imitation' },
}, required: ['slug', 'verdict', 'summary', 'remaining_gaps', 'tries'] }

// One Match protocol for both modes. Study mode allows 3 tries; fix mode allows the user's retries
// number, and the Fix stage's own attempt is try 1.
const matchPrompt = (s, maxTries, extra) => `${CONTEXT}\n${RULES}\n${refPrompt(s.slug, s.k)}\nMATCH-CHECK the imitation ${BAR}/${s.slug}/index.html against the original (${CAPTURES}/${s.slug}/original/) using the study's Drive script and Viewport.${extra || ''}
Loop, at most ${maxTries} ${maxTries === 1 ? 'try' : 'tries'} in total: (1) capture the imitation with the same inputs and timing into ${BAR}/${s.slug}/capture/ (git-ignored); (2) extract frames at the same rate and measure every Timeline row on the imitation; (3) compare original and imitation row by row (a timing within 10 percent or 50 ms, whichever is larger, and the same easing shape and end values count as matched) and frame by frame at each Key frame timestamp (same composition, same motion path); (4) if anything differs and a try is left, fix index.html (keep numbers in the MOTION block) and try again.
Then make the side-by-side: ${BAR}/${s.slug}/capture/side-by-side.mp4, original left and imitation right, same height, trimmed to the same span, labeled "original" and "imitation" (ffmpeg hstack and drawtext), and ${BAR}/${s.slug}/capture/strip.jpg, a frame strip of the Key frames with original above imitation. Write ${BAR}/${s.slug}/compare.json: {"slug","url","group","verdict":"match|close|gap|blocked","rows":[{"what","orig_ms":[start,end],"imit_ms":[start,end],"orig_easing","imit_easing","matched":true|false}],"remaining_gaps":[...],"tries":n,"original_video":"${ORIGINAL_VIDEO}","side_by_side":"bar-pages/<slug>/capture/side-by-side.mp4","strip":"bar-pages/<slug>/capture/strip.jpg","imitation":"bar-pages/<slug>/index.html","summary":"one or two sentences"}. Verdict "blocked" only when the original could not be captured at all. Delete capture/tmp/ and any per-try frame folders before you return. Return the verdict.`

const items = args.slugs.map((slug, k) => ({ slug, k }))
const waves = Array.from({ length: Math.ceil(items.length / WAVE) }, (_, w) => items.slice(w * WAVE, (w + 1) * WAVE))
const results = []

const studyStages = [
  ({ slug, k }) => agent(`${CONTEXT}\n${RULES}\n${refPrompt(slug, k)}\nSTUDY the original's motion precisely. If the entry has a study path, start from that study and its .verify.json sibling (trust the verify file where it weakens a claim), capture the original anyway so the review page can show it, and fill the format. If the folder already has a study.md from an earlier cut-off run, check it against fresh frames rather than trusting it. ${STUDY_FORMAT}\nReturn the slug and whether the entry had an existing study ("reused" or "new").`,
    { label: `study:${slug}`, phase: 'Study', model: 'opus', schema: { type: 'object', properties: { slug: { type: 'string' }, kind: { type: 'string', enum: ['reused', 'new'] }, captured: { type: 'boolean' } }, required: ['slug', 'kind', 'captured'] } }).then(s => s && { ...s, slug, k }),
  (s) => !ok(s) ? null : s.kind === 'reused' ? s : agent(`${CONTEXT}\n${RULES}\n${refPrompt(s.slug, s.k)}\nYou are a refuter. Read ${BAR}/${s.slug}/study.md and ${BAR}/${s.slug}/trace-original.json. Re-extract frames from the original capture under ${CAPTURES}/${s.slug}/original/ and re-measure every Timeline row and a spread of trace samples. Correct both files in place: fix wrong timings, values and easing; remove claims the frames do not show; add transitions the study missed. Check that trace-original.json has 2 to 5 channels and an "fps" equal to the rate you sampled at; trim or fix it if not. Add a short "Refuter changes" section at the end of study.md listing each change. Return counts.`,
    { label: `refute:${s.slug}`, phase: 'Refute', model: 'opus', schema: { type: 'object', properties: { confirmed: { type: 'integer' }, corrected: { type: 'integer' }, added: { type: 'integer' } }, required: ['confirmed', 'corrected', 'added'] } }).then(r => r && { ...s, refute: r }),
  (s) => !ok(s) ? null : agent(`${CONTEXT}\n${RULES}\n${refPrompt(s.slug, s.k)}\nBUILD the bar page from ${BAR}/${s.slug}/study.md. Write ${BAR}/${s.slug}/index.html: one file, no build step, opens from file://. Libraries only from cdnjs.cloudflare.com or cdn.jsdelivr.net/npm with an exact version, or none. Match the study's Timeline exactly: same order, timings, distances, easing shapes and overlap, at the study's Viewport. Put every motion number in one const block at the top named MOTION, with a comment per value naming the Timeline row it comes from. Drive all motion from one requestAnimationFrame clock; never time motion with setTimeout or setInterval. Support prefers-reduced-motion with a still frame of the rest state. Use a capped time step and stop any loop at rest when nothing moves, unless the original loops forever. Neutral placeholder content drawn in code; no brand assets. Also write ${BAR}/${s.slug}/notes.md: what the page teaches, how to reuse it, and the MOTION values. Open the page once headless with capture.mjs to confirm it renders and has no console errors, and quote the result. Return what you built in one line.`,
    { label: `build:${s.slug}`, phase: 'Build', model: 'sonnet' }).then(b => b && s),
  (s) => !ok(s) ? null : agent(matchPrompt(s, 3), { label: `match:${s.slug}`, phase: 'Match', model: 'opus', schema: VERDICT }),
]

const REVIEWS = BAR + '/reviews.json'
const fixStages = [
  ({ slug, k }) => agent(`${CONTEXT}\n${RULES}\n${refPrompt(slug, k)}\nFIX this bar page. The user graded it Close. Read their mark for "${slug}" in ${REVIEWS} with node: "note" says what is wrong in their eyes, "retries" caps the tries. Their note is the brief: the job is done when their note is no longer true of the page. Also read study.md, notes.md, compare.json (its remaining_gaps often name the same fault) and index.html in your folder.
Step 1, diagnose: look again at the original capture and key frames under ${CAPTURES}/${slug}/original/, closer than the study did (crop and zoom the frames that show the fault). Decide whether the study misread the original or the build misread the study. Other pages in the same group (same "group" in refs.json) that the user graded "pass" in ${REVIEWS} may show how the same thing was solved: read their study.md and index.html if it helps.
Step 2, fix: if the study was wrong, correct study.md first and add a "Fix changes" section at its end naming each change and the frames that prove it. Then fix index.html. Change only what the note and the diagnosis need; keep every MOTION value that already matched. Open the page once headless with capture.mjs to confirm it renders with no console errors.
Do not capture a side-by-side or write compare.json: the next stage re-checks the page. Return the diagnosis in one or two plain sentences and the list of changes.`,
    { label: `fix:${slug}`, phase: 'Fix', model: 'opus', schema: { type: 'object', properties: { slug: { type: 'string' }, retries: { type: 'integer' }, diagnosis: { type: 'string' }, changes: { type: 'array', items: { type: 'string' } } }, required: ['slug', 'retries', 'diagnosis', 'changes'] } }).then(f => f && { ...f, slug, k }),
  (s) => !ok(s) ? null : agent(matchPrompt(s, Math.max(1, Math.min(s.retries || 1, 10)), `
This is a FIX re-check. The user's note for this page (in ${REVIEWS}) says what was wrong; the fix stage diagnosed it as "${String(s.diagnosis).replace(/[`$]/g, '')}". The fix stage's edit is try 1 of the user's cap, so only fix again while tries are left. Besides the rows, compare the frames that show the user's note side by side, and set note_addressed to whether their note is still true of the imitation (false if it is). Add a "fix" field to compare.json: {"note", "diagnosis", "addressed": true|false, "evidence": "the frame times and what they show"}.`),
    { label: `match:${s.slug}`, phase: 'Match', model: 'opus', schema: VERDICT }),
]

// Intake: steps 1 to 5 and the bar's own gates from the spec's "Intake procedure". Each agent writes
// only its own bars/<slug>/ folder in the kit, so a wave runs in parallel. Every shared file
// (kinds/*/dials.json, bars/INDEX.md, knob-values.ts, src/, tests) and every commit is the
// driver's, one bar at a time, after the user's answers (see SKILL.md, "Intake mode").
const GATED_KINDS = ['live', 'idle', 'scroll', 'choreo', 'sim']
const TOOLS = `${SKILL}/scripts/intake`
const INTAKE_RULES = `
STANDING RULES (scoped):
- Truth: every number comes from a capture, a file or a command you ran in this run. Quote command output for every gate claim.
- Write ONLY inside ${KIT}/bars/<slug>/ (the bar) and ${BAR}/<slug>/intake/ (your scratch: measuring scripts, logs, frame crops). Never edit the graded page or any other file in ${BAR}/<slug>/: it is the record of what was graded. In the kit never touch src/, kinds/, test/, scripts/, bars/INDEX.md, bars/moments.json, any other bar folder, package.json or the lockfile. Never run git add, git commit, git stash, git checkout or any other git write. Never run pnpm gen:bars, gen:knobs, pnpm test or pnpm test:bars: other bars are being built in parallel, and the driver runs the full gates.
- Public files (index.html, bar.json, notes.md, trace.json, gate.test.ts and anything the page loads) carry no personal name, no home or private path, no link to a private repo, chat or shelf, and no words about the maintainer, grading by eye, approval, likes, stars or ratings. ${PRIVATE_RULE} Either way, no names, home paths, "claude-env" or shelf paths there (say "the original capture" instead). Kit words such as base, bar, kind and gate are fine.
- Gates run in plain foreground commands with an explicit timeout up to 600000 ms; no run_in_background. Only your own bar's checks.
- Never Read a file over 800 lines whole. Plain words in every doc: no em dashes, en dashes or arrows.
- Captures are local reference only: never copy a frame, video or picture of the original into the kit.
- Bars enter the kit checkout. Publishing a bar is a later step behind a publish gate and is not your job: never stop on publishing. Mark the page's <body> with data-ui-embed: it is a replica of another product's screen, and the UI lint then skips that screen's own type, spacing and contrast.
`
const driverNotes = (slug) => (NOTE || BRIEFS[slug]) ? `\nDRIVER FINDINGS. Settled by the driver from earlier calibration or the maintainer's decisions. Apply them; do not re-derive or undo them. Where one changes a MOTION value, list it in motionChanges with this reason.${NOTE ? '\n- ' + NOTE : ''}${BRIEFS[slug] ? '\n- ' + BRIEFS[slug] : ''}\n` : ''
const intakeRef = (slug, k) => `Your bar is "${slug}". The graded page and its records: ${BAR}/${slug}/ (index.html, study.md, notes.md, compare.json, and trace-original.json when present). Its refs.json entry: ${REFS}. Its grade: the "${slug}" mark in ${BAR}/reviews.json. The original capture: ${CAPTURES}/${slug}/original/ (video plus frames; the study names which captures it used and any per-frame logs). The kit: ${KIT}. drive.mjs ports for you if you must recapture the original: ${PORT + k * 2} and ${PORT + k * 2 + 1}.${driverNotes(slug)}`
// Worked examples: the first choice per kind, kept only when the kit has that bar.
const PREFERRED = { sim: '11-dissolve-into-own-particles', choreo: '18-staged-reveal', live: '13-drag-past-a-threshold', idle: '31-breath-pacer', scroll: '04-scale-as-camera' }
const FOUND = Object.entries(PREFERRED).filter(([, n]) => KIT_BARS.includes(n)).map(([kind, n]) => `${kind} ${KIT}/bars/${n}`)
const EXAMPLES_LINE = FOUND.length
  ? `${FOUND.join(', ')}. For a kind not listed, read the bar of the nearest kind and say so in your result.`
  : `ls ${KIT}/bars/ and read the bar whose bar.json lists your main kind first, else the nearest kind, and say so in your result.`
const PILOTS = [['13-drag-past-a-threshold', 'live, a video original'], ['31-breath-pacer', 'idle'], ['04-scale-as-camera', 'scroll, a live-site original with a per-frame log']]
  .filter(([n]) => KIT_BARS.includes(n)).map(([n, d]) => `${KIT}/bars/${n} (${d})`)
const PILOT_LINE = PILOTS.length
  ? `Finished bars are already in the kit and are your worked example: ${PILOTS.join(', ')}.`
  : `Finished bars are already in the kit: ls ${KIT}/bars/ and take those as your worked example.`
const DIAL_RULE = KIT_DIAL_SET
  ? `Name each dial (its knob key) by an entry of the dial set: read every ${KIT}/kinds/*/dial-set.json, and reuse an entry whose meaning fits the number. If none fits, add one to newDials with name "<main kind>.<camelCase>", unit ("s", or "s,ratio" for a spring) and meaning (one plain sentence about the concept, never about this page; say "move", not "flight"), and use that name. Never edit dial-set.json yourself: the driver adds new entries, so validate-bar's "not in dial-set.json" line for a newDials name is expected and every other check must pass. A name that is a public knob (a key of ${KIT}/src/core/kinds.ts KNOB_FIELDS) also needs a dials.json entry, which the driver writes from the dial's kitValue and convert. `
  : `Name each dial (its knob key) by a key of KNOB_FIELDS in ${KIT}/src/core/kinds.ts: this kit keeps no dial-set files, and validate-bar accepts no other knob. Each dial also needs an entry in ${KIT}/kinds/<kind>/dials.json, which the driver writes from the dial's kitValue and convert. Leave newDials empty. You may not touch kinds/, so validate-bar's line "has no <knob> entry for <slug>" for each of your dials is expected: the driver writes those entries afterwards. Every other check must pass. Return status "blocked" only for a feel number that no KNOB_FIELDS key fits (a choreo or sim bar has no such key yet): quote validate-bar's line and say so in reason. A number that fits no key stays in MOTION and notes.md. `
const LEAN_SHAPE = `
THE FINISHED SHAPE. Read ONE finished bar of your main kind as the worked example, nothing more: ${EXAMPLES_LINE} Read its bar.json and gate.test.ts whole, and only the hook section of its index.html (grep -n "__seek\\|__state\\|motion-kit:" first). Read ${KIT}/kinds/<kind>/rules.md section "What the gate needs from the page". Open the BarJson interface (${KIT}/src/core/bar.ts), TOLERANCE_FLOORS (${KIT}/src/core/trace.ts), ${KIT}/${KIT_DOC} or ${SPEC_REF} only for a question the example does not answer, and then grep, never read whole.`
const INTAKE_SHAPE = `
THE FINISHED SHAPE. ${PILOT_LINE} Read each one's bar.json, gate.test.ts and the hook section of index.html (grep -n "__seek\\|__state\\|motion-kit:" first). If the bar home holds an earlier bar's scratch (${BAR}/<slug>/intake/make-trace.*), it shows how that trace was measured. The contract: ${KIT}/${KIT_DOC}, the BarJson interface in ${KIT}/src/core/bar.ts, the TraceJson format and TOLERANCE_FLOORS in ${KIT}/src/core/trace.ts, the kind rules in ${KIT}/kinds/<kind>/rules.md (read its "What the gate needs from the page" section whole), and ${SPEC_REF}, sections "bar.json fields", "Page hooks that intake adds", "trace.json", "Gate A" and "Gate B".`
const INTAKE_TOOLS = `
Generic intake tools (run with node and MOTION_KIT=${KIT} set, so they read this kit checkout; each prints its usage): ${TOOLS}/rebuild-error.ts <page> <trace> [--write] sets each tolerance to max(2 x the rebuild's own error, the unit floor); ${TOOLS}/fault-effects.ts <bar dir> shows each planted fault's effect in tolerances and whether Gate A catches it; ${TOOLS}/leak-scan.mjs <bar dir> runs the leak guards; ${TOOLS}/motion-diff.mjs <graded index.html> <bar index.html> proves the MOTION numbers were kept.
Kit commands, run from ${KIT}: node src/cli/motion-kit.ts validate-bar bars/<slug>; node src/cli/motion-kit.ts gate bars/<slug>/index.html (Gate B); node src/cli/motion-kit.ts sheet bars/<slug>/index.html --out <scratch>/sheet.png (then Read the PNG); npx vitest run --config vitest.bars.config.ts bars/<slug>/gate.test.ts (Gate A, Gate B and every planted fault).`

const INTAKE_RESULT = { type: 'object', properties: {
  slug: { type: 'string' },
  status: { type: 'string', enum: ['ready', 'blocked', 'engine-gap', 'needs-decision'], description: 'ready: every own check below passed. blocked: grade or kind stops intake. engine-gap: the kit gate itself is wrong for this page. needs-decision: a new moment is needed.' },
  reason: { type: 'string', description: 'One or two plain sentences' },
  kind: { type: 'string' },
  moments: { type: 'array', items: { type: 'string' } },
  newMoment: { type: 'object', properties: { name: { type: 'string' }, meaning: { type: 'string' } } },
  dials: { type: 'array', items: { type: 'object', properties: { knob: { type: 'string' }, path: { type: 'string' }, value: { type: 'number' }, unit: { type: 'string' }, row: { type: 'string' }, kitValue: { description: 'The value in the knob field\'s own shape and unit (seconds; a spring as visualDuration and bounce via fromPhysics)' }, convert: { type: 'string' } }, required: ['knob', 'path', 'value', 'unit', 'row'] } },
  newDials: { type: 'array', description: 'Each dial-set entry a dial needs that no kinds/<kind>/dial-set.json holds yet; the driver adds it', items: { type: 'object', properties: { name: { type: 'string' }, unit: { type: 'string' }, meaning: { type: 'string' } }, required: ['name', 'unit', 'meaning'] } },
  motionChanges: { type: 'array', items: { type: 'string' }, description: 'Every MOTION value motion-diff reports changed or removed, each with its reason' },
  checks: { type: 'object', description: 'Each check: "passed" or the failure line, quoted from its output', properties: { validateBar: { type: 'string' }, leakScan: { type: 'string' }, motionDiff: { type: 'string' }, faultEffects: { type: 'string' }, gateTest: { type: 'string' }, kindGate: { type: 'string' }, sheet: { type: 'string', description: 'What the sheet shows against the original key frames' } } },
  engineGaps: { type: 'array', items: { type: 'string' }, description: 'Paths of engine-gap notes under the intake scratch' },
  commitNotes: { type: 'string', description: 'The Solution part of the commit message: what each file holds, the trace window and rows, each tolerance and why' },
}, required: ['slug', 'status', 'reason', 'kind', 'moments', 'dials', 'checks', 'commitNotes'] }

const LEAN_CHECK = `
NO CHECK AGENT FOLLOWS YOU. Before you return "ready", also do the refuter's two cheap checks yourself: (a) run rebuild-error.ts without --write and quote its per-channel errors; near-zero error on every channel means the trace was taken from the rebuild, so measure it again from the original; (b) re-measure 5 trace rows per channel on your own fresh frame extraction and quote the largest difference. Keep tool output short: pipe long output through tail or grep. Read the sheet once.`
const SHAPE = (LEAN ? LEAN_SHAPE : INTAKE_SHAPE) + INTAKE_TOOLS
const intakeStages = [
  ({ slug, k }) => agent(`${CONTEXT}\n${INTAKE_RULES}\n${intakeRef(slug, k)}\n${SHAPE}
INTAKE this graded page into motion-kit as the bar ${KIT}/bars/${slug}/. Follow ${SPEC_REF}, section "Intake procedure", steps 1 to 5 and the bar's own gates:
1. Confirm the grade with node: "pass" enters; "close" enters only when its note says only the assets or pictures are wrong. Pick the main kind from the study's Input: a pointer drag is live, a loop on a clock is idle, scroll position is scroll, a staggered sequence after one tap, scroll or load is choreo, bodies moved by physics after a cause are sim. Only ${GATED_KINDS.join(', ')} have a kind gate today. If the grade does not enter, or the main kind is none of those (a hover with no press, a device tilt), stop and return status "blocked" with the reason. A choreo or sim page needs units in __state() (bodies in px or deg), and its trace input is the cause: the original's taps or scroll, or {"kind": "none"} for a page that starts on load. Calibration may already have hooked the page: start from ${BAR}/<slug>/intake/calibrate/index.html when it exists, and check it against the graded page with motion-diff. If ${KIT}/bars/${slug}/ already exists, stop and return "blocked".
2. Copy the graded index.html, study.md and notes.md into the bar folder, plus any local file the page loads (fonts with their license). Write bar.private.json: {"source": {"url", "captured": the capture date}, "grade": {"verdict": "pass" or "close-assets", "date", "note"}}. Scrub the public files and study.md as the rules say. notes.md says how to reuse the page and what it teaches, never how it was made or checked.
3. Add the page hooks without changing what the page does: the <meta name="motion-kit-bar" content="${slug}"> marker; a ?seek mode that runs no live loop; window.__seek(ms), which re-runs the page from 0 to ms in fixed 1/60 s steps and feeds window.__input on the way (pointer samples with the down flag, or scroll targets), so the state never depends on what was seeked before; window.__state(), which returns {values, events} for the trace channels; every setTimeout, setInterval, performance.now() and Date.now() marked // motion-kit:clock or // motion-kit:not-motion, with no motion timed by a timer; one capped time step; the live loop stops at rest (unless it loops forever on screen); reduced motion as the kind's rules say. Prove the live run is unchanged: record it before and after your edits on a faked clock and compare (a script in your scratch that loads the page, steps the faked clock and logs the traced values). Keep every MOTION value; if one must change (a public label, a time-step cap the gate demands), say why in motionChanges.
4. Write trace.json from the ORIGINAL capture, never from the rebuild (then Gate A would only prove the rebuild matches itself). Use trace-original.json when present and it holds 2 to 5 fitting channels; else measure the original frames yourself with a script in your scratch, as the pilot did. 2 to 5 channels that carry the mechanism, each with name, unit (a TOLERANCE_FLOORS unit), read (its key in __state().values) and the selectors of the elements it reads; rows on the 1/60 s grid (k * 1000 / 60), sparse where the original holds or is not measured, null where a channel is not measured; the input that drove the original, one sample per 1/60 s; events in ms; cuts where the original has a hard cut. Then run rebuild-error.ts --write. A tolerance far above the motion it guards makes Gate A blind: say so in commitNotes.
5. Write bar.json: moments from ${KIT}/bars/moments.json (if none fits, return status "needs-decision" with newMoment, and do not invent one); rung; fits, wrongFor and feel (feel at most 300 characters, what the motion does in time, with its main numbers); 1 to 5 dials, each a MOTION number that sets how the mechanism feels in time, not where things sit and not a time-step cap. ${DIAL_RULE}This never needs a decision from anyone: status stays "ready"; the asset contract, one slot per drawn asset; clock "__seek"; trace with each channel's tolerance; cover for moving elements no channel reads; and at least one own fault that breaks this bar's signature motion (a find string that occurs exactly once in index.html). Write gate.test.ts as the one-line barGateSuite call the pilot bars use.
Then run every check and fix what fails, in this order: fault-effects.ts (each fault must fail Gate A, and a fault under 1 x tolerance on every channel is caught by luck: strengthen it); validate-bar; leak-scan.mjs; motion-diff.mjs against the graded page; the bar's gate.test.ts under vitest; motion-kit gate; motion-kit sheet, then Read sheet.png beside the original key frames and say whether the motion reads the same.
If a check fails because the kit's gate itself mis-judges this page (the pilot found about ten such gaps: a rule that misreads a legal motion, a harness that cannot feed this input), do not bend the page to hide it and do not edit the kit's src/: write ${BAR}/${slug}/intake/engine-gap-<n>.md with the failing line, a minimal repro, why the page is right, and a proposed patch with the planted-fault test it would need, then return "engine-gap".
${LEAN ? LEAN_CHECK + '\n' : ''}Return the result object. commitNotes is plain words in the style of the pilot commits.`,
    { label: `intake:${slug}`, phase: 'Intake', model: 'opus', schema: INTAKE_RESULT }).then(r => r && { ...r, slug, k }),
  (r) => !ok(r) ? null : r.status !== 'ready' ? r : agent(`${CONTEXT}\n${INTAKE_RULES}\n${intakeRef(r.slug, r.k)}\n${SHAPE}
CHECK the new bar ${KIT}/bars/${r.slug}/. You are a refuter: the intake agent says it is ready. Try to prove it wrong, and fix in place, inside the bar folder only, what you prove wrong.
1. The trace is from the original. Extract frames from the original capture yourself (your own extraction under ${BAR}/${r.slug}/intake/check/, not the intake agent's crops) and re-measure at least 10 trace rows per channel, spread over every measured window, plus every event. Compare with trace.json. Also seek the bar at those rows and read __state(): a trace that sits on the rebuild's values with near-zero error everywhere, while the compare.json rows show real timing gaps, was traced from the rebuild. Check the input samples against the capture's own log or drive script.
2. The tolerances: rerun rebuild-error.ts (without --write) and confirm each tolerance is max(2 x the error, the floor). Name any tolerance that is larger than the motion it guards.
3. The numbers were kept: motion-diff.mjs against the graded page. Every changed or removed value needs a reason that holds.
4. bar.json reads true: feel and fits match the study's Timeline numbers; the moments fit ${KIT}/bars/moments.json meanings; each dial is a feel number from MOTION (not a position) and ${KIT_DIAL_SET ? 'its dial-set entry means what the number does' : 'its knob is a KNOB_FIELDS key that fits what the number does'}; the asset contract names every drawn asset; the own fault breaks the signature motion.
5. The public text: leak-scan.mjs, and read notes.md and bar.json for words about how the page was made, checked or rated.
6. Rerun the bar's gate.test.ts under vitest and motion-kit gate, and quote the result lines.
${r.newDials?.length ? `The intake agent adds dial-set entries (${r.newDials.map(n => n.name).join(', ')}); validate-bar's "not in dial-set.json" lines for those are expected. In step 4, refute each one: if an entry already in a kinds/*/dial-set.json means the same thing, rename the dial to it and drop it from newDials; if its meaning names this page instead of the concept, rewrite it. ` : ''}${KIT_DIAL_SET ? '' : `validate-bar's "has no <knob> entry for <slug>" lines are expected: the driver writes the dials.json entries afterwards. `}Return the result object with status "ready" only when all six hold after your fixes, and add to commitNotes one line per fix you made.`,
    { label: `check:${r.slug}`, phase: 'Check', model: 'opus', schema: INTAKE_RESULT }).then(c => c && { ...c, slug: r.slug, intake: { status: r.status, reason: r.reason } }),
]

const stages = MODE === 'fix' ? fixStages : MODE === 'intake' ? (LEAN ? intakeStages.slice(0, 1) : intakeStages) : studyStages
for (let w = 0; w < waves.length; w++) {
  log(`${MODE} wave ${w + 1} of ${waves.length}: ${waves[w].map(x => x.slug).join(', ')}`)
  const out = await pipeline(waves[w], ...stages)
  for (const r of out) if (r) results.push(r)
  const lost = waves[w].filter((x, k) => !out[k]).map(x => x.slug)
  if (lost.length) log(`wave ${w + 1}: no result for ${lost.join(', ')}`)
}

const tally = results.reduce((t, r) => { const v = r.verdict || r.status; t[v] = (t[v] || 0) + 1; return t }, {})
log(`verdicts: ${JSON.stringify(tally)}`)
return { mode: MODE, tally, results }
