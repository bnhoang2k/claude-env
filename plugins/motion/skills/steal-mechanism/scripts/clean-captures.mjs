#!/usr/bin/env node
// Deletes the check pictures and videos a run leaves behind, keeping only the final results.
// Agents are told to clean up after themselves, and many do not, so this runs after every run.
//
// In each <bar-home>/<slug>/ folder it keeps:
//   capture/side-by-side.mp4 and capture/strip.jpg (what the review page shows)
//   every file git tracks (study.md, index.html, compare.json and the rest)
// and deletes:
//   everything else under capture/ (try folders, tmp/, per-try frames and videos)
//   untracked pictures and videos anywhere else in the page folder (check/, measure/ and similar)
// It never touches the original captures, which live outside the bar home.
//
// Usage: node clean-captures.mjs <bar-home> [--apply] [<slug> ...]
// Without --apply it only lists what it would delete. Exit 0; 2 on bad input; 3 when a file
// vanishes during the scan (a run is still writing), and then nothing is deleted.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const [bar, ...slugs] = args.filter(a => a !== '--apply')
if (!bar || !fs.existsSync(path.join(bar, 'refs.json'))) {
  console.error('usage: node clean-captures.mjs <bar-home> [--apply] [<slug> ...]  (bar-home must hold refs.json)')
  process.exit(2)
}
const home = path.resolve(bar)
const KEEP = new Set(['capture/side-by-side.mp4', 'capture/strip.jpg'])
const MEDIA = /\.(png|jpe?g|webp|gif|bmp|tiff?|mp4|webm|mov|mkv|avi|y4m|raw)$/i

let tracked = new Set()
try {
  const top = execFileSync('git', ['-C', home, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  tracked = new Set(execFileSync('git', ['-C', top, 'ls-files', '-z', '--', home], { encoding: 'utf8' })
    .split('\0').filter(Boolean).map(f => path.join(top, f)))
} catch { /* not a git repo: nothing counts as tracked */ }

const pages = (slugs.length ? slugs : fs.readdirSync(home))
  .filter(s => fs.existsSync(path.join(home, s, 'compare.json')) || fs.existsSync(path.join(home, s, 'study.md')))

const size = (p) => {
  const st = fs.lstatSync(p)
  if (!st.isDirectory()) return st.size
  return fs.readdirSync(p).reduce((n, f) => n + size(path.join(p, f)), 0)
}
const hasTracked = (p) => [...tracked].some(t => t === p || t.startsWith(p + path.sep))

const doomed = []
for (const slug of pages) {
  const dir = path.join(home, slug)
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(dir, rel))) {
      const r = rel ? rel + '/' + name : name
      const abs = path.join(dir, r)
      const st = fs.lstatSync(abs)
      if (KEEP.has(r) || tracked.has(abs)) continue
      if (st.isSymbolicLink()) continue
      const inCapture = r === 'capture' || r.startsWith('capture/')
      if (st.isDirectory()) {
        if (inCapture && r !== 'capture' && !hasTracked(abs)) doomed.push(abs)
        else walk(r)
      } else if (inCapture || MEDIA.test(name)) {
        doomed.push(abs)
      }
    }
  }
  walk('')
}

let total = 0
try {
  total = doomed.reduce((n, p) => n + size(p), 0)
} catch (e) {
  if (e.code !== 'ENOENT') throw e
  console.error(`a file vanished during the scan (${path.relative(home, e.path)}): a run is probably still writing there. Nothing was deleted.`)
  process.exit(3)
}
const mb = (n) => (n / 1048576).toFixed(1) + ' MB'
for (const p of doomed) console.log((apply ? 'deleted ' : 'would delete ') + path.relative(home, p))
if (apply) for (const p of doomed) fs.rmSync(p, { recursive: true, force: true })
console.log(`${apply ? 'freed' : 'would free'} ${mb(total)} in ${doomed.length} items across ${pages.length} pages`)
