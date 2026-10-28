#!/usr/bin/env node
// Clears the user's grade for pages a fix run changed, so the review page shows them as unmarked.
// The old mark is kept: it is appended to reviews-history.json beside reviews.json.
//
// Usage: node regrade.mjs <bar-home> <slug> [<slug> ...]
// Exits 1 when a slug has no mark, and changes nothing in that case.

import fs from 'node:fs'
import path from 'node:path'

const [bar, ...slugs] = process.argv.slice(2)
if (!bar || slugs.length === 0) {
  console.error('usage: node regrade.mjs <bar-home> <slug> [<slug> ...]')
  process.exit(2)
}
const reviewsPath = path.join(bar, 'reviews.json')
const historyPath = path.join(bar, 'reviews-history.json')
const reviews = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'))
const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : []

const missing = slugs.filter(s => !reviews[s])
if (missing.length) {
  console.error(`no mark for: ${missing.join(', ')}`)
  process.exit(1)
}
const at = new Date().toISOString()
for (const slug of slugs) {
  history.push({ slug, mark: reviews[slug], cleared: at, reason: 'fix run changed the page' })
  delete reviews[slug]
}
fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n')
fs.writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2) + '\n')
console.log(`cleared ${slugs.length}: ${slugs.join(', ')}; history now holds ${history.length}`)
