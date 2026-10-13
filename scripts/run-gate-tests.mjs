#!/usr/bin/env node
/**
 * Runs the gate-script self-tests (`npm run test:scripts`).
 *
 * `node --test scripts/` is shorter, but the test runner's treatment of a
 * directory argument differs across the Node versions this project supports: on
 * Node 24, which CI uses, the positional is loaded as a module and the run dies
 * with MODULE_NOT_FOUND, while Node 26 expands the directory recursively. A
 * gate that works on some versions and not others is not a gate — and the first
 * time this surfaced was the pre-push hook, after the commit looked fine.
 *
 * So discovery happens here instead: walk `scripts/` for `*.test.mjs` and import
 * each, letting `node:test` register and run them. Importing rather than
 * shelling out also means a test file that fails to load is an error on this
 * step, not a silent skip.
 */
import { readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))

function findTestFiles(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...findTestFiles(full))
    else if (entry.endsWith('.test.mjs')) found.push(full)
  }
  return found.sort()
}

const files = findTestFiles(scriptsDir)

if (files.length === 0) {
  console.error(
    `✖ no *.test.mjs found under ${scriptsDir} — the gate self-tests found nothing to run`
  )
  process.exit(1)
}

console.log(`Running ${files.length} gate test files`)
for (const file of files) await import(pathToFileURL(file).href)
