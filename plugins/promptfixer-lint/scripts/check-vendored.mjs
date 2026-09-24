#!/usr/bin/env node
/**
 * Drift check for the two vendored linter files.
 *
 * Compares scripts/analyze.js and scripts/promptfixer-lint.js against their
 * upstream originals in the PromptFixer checkout. analyze.js must match byte
 * for byte; promptfixer-lint.js may differ on exactly one line, the import
 * rewritten when the file was vendored. Anything else is drift and exits 1.
 *
 *   node scripts/check-vendored.mjs [path-to-PromptFixer]
 *
 * The upstream root also comes from $PROMPTFIXER_DIR, else ../../../../PromptFixer
 * relative to this script (i.e. a PromptFixer checkout beside claude-plugins).
 *
 * Exit codes: 0 in sync, 1 drift, 2 cannot check (upstream or vendored file missing).
 */

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const upstreamRoot = path.resolve(
  process.argv[2] || process.env.PROMPTFIXER_DIR || path.join(scriptDir, '..', '..', '..', '..', 'PromptFixer')
)

// The only edits the vendoring is allowed to make, applied to promptfixer-lint.js.
// Every difference outside this list is drift and fails the check.
const ALLOWED_EDITS = [
  {
    why: 'import path: the vendored copy sits beside analyze.js',
    upstream: "import { analyzePrompt } from '../server/analyze.js'",
    vendored: "import { analyzePrompt } from './analyze.js'",
  },
  {
    why: 'usage text names the vendored filename, not the upstream one',
    upstream: ' *   node scripts/lint-prompts.js <path...> [--intent <id>] [--min-score <n>]',
    vendored: ' *   node scripts/promptfixer-lint.js <path...> [--intent <id>] [--min-score <n>]',
  },
  {
    why: 'usage text names the vendored filename, not the upstream one',
    upstream:
      'const USAGE = `Usage: node scripts/lint-prompts.js <path...> [--intent <id>] [--min-score <n>] [--fail-on high|medium|low|none] [--json] [--quiet]',
    vendored:
      'const USAGE = `Usage: node scripts/promptfixer-lint.js <path...> [--intent <id>] [--min-score <n>] [--fail-on high|medium|low|none] [--json] [--quiet]',
  },
]

const FILES = [
  { vendored: 'analyze.js', upstream: 'server/analyze.js', allowEdit: false },
  { vendored: 'promptfixer-lint.js', upstream: 'scripts/lint-prompts.js', allowEdit: true },
]

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const lines = (text) => text.split(/\r?\n/)

function read(file) {
  try {
    return fs.readFileSync(file)
  } catch (err) {
    return { error: err.code === 'ENOENT' ? `not found: ${file}` : `cannot read ${file}: ${err.message}` }
  }
}

/** @returns {{ drift: string[], edits: number }} */
function compare(upstreamText, vendoredText, allowEdit) {
  const a = lines(upstreamText)
  const b = lines(vendoredText)
  const drift = []
  let edits = 0
  if (a.length !== b.length) {
    drift.push(`line count differs: upstream ${a.length}, vendored ${b.length}`)
  }
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue
    if (allowEdit && ALLOWED_EDITS.some((e) => a[i] === e.upstream && b[i] === e.vendored)) {
      edits++
      continue
    }
    drift.push(`line ${i + 1} differs\n    upstream: ${a[i]}\n    vendored: ${b[i]}`)
  }
  return { drift, edits }
}

let failed = false
let blocked = false
const report = []

for (const entry of FILES) {
  const vendoredPath = path.join(scriptDir, entry.vendored)
  const upstreamPath = path.join(upstreamRoot, entry.upstream)
  const vendored = read(vendoredPath)
  const upstream = read(upstreamPath)
  if (vendored.error || upstream.error) {
    blocked = true
    report.push(`SKIP  ${entry.vendored}  ${(vendored.error || upstream.error).replaceAll(path.sep, '/')}`)
    continue
  }

  if (sha256(vendored) === sha256(upstream)) {
    report.push(`OK    ${entry.vendored}  identical to ${entry.upstream}`)
    continue
  }

  const { drift, edits } = compare(upstream.toString('utf8'), vendored.toString('utf8'), entry.allowEdit)
  if (drift.length === 0 && entry.allowEdit && edits > 0) {
    const word = edits === 1 ? 'edit' : 'edits'
    report.push(`OK    ${entry.vendored}  matches ${entry.upstream} apart from ${edits} known ${word}`)
    continue
  }
  if (drift.length === 0) {
    // Same lines but different bytes: line endings, BOM or trailing newline.
    failed = true
    report.push(`DRIFT ${entry.vendored}  same lines as ${entry.upstream} but different bytes (line endings, BOM or final newline)`)
    continue
  }
  failed = true
  report.push(`DRIFT ${entry.vendored}  vs ${entry.upstream}\n  ${drift.join('\n  ')}`)
}

process.stdout.write(`upstream: ${upstreamRoot.replaceAll(path.sep, '/')}\n${report.join('\n')}\n`)

if (blocked) {
  process.stderr.write('check-vendored: could not compare every file; pass the PromptFixer checkout as an argument\n')
  process.exitCode = 2
} else if (failed) {
  process.stderr.write('check-vendored: vendored files have drifted from upstream\n')
  process.exitCode = 1
} else {
  process.stdout.write('in sync\n')
  process.exitCode = 0
}
