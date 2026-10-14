#!/usr/bin/env node
/**
 * Counts that the README and CONTRIBUTING prose claims, measured from the tree.
 *
 * These are the numbers a human can get wrong silently: the prose states them, and
 * nothing checked them against the repository. Each one has exactly one definition
 * here, so a claim and the thing it counts cannot drift into two different units.
 *
 * Suite *case* counts are deliberately absent — only a test run knows those, and a
 * listing disagrees with the run for this repo's suite (measured: `vitest list`
 * prints 1037 ids for a run that reports 1039 tests). They stay CI-supplied.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

/** English developer guides — one file per bilingual pair. */
export function developerDocs(root) {
  return readdirSync(join(root, 'docs/developer')).filter(file =>
    file.endsWith('.en.md')
  ).length
}

/** Every Markdown file under docs/, counting both languages. */
export function docsMarkdownFiles(root) {
  return walk(join(root, 'docs')).filter(file => file.endsWith('.md')).length
}

/** ast-grep rule files, which is what "N rules enforced in CI" claims about. */
export function astRules(root) {
  return walk(join(root, '.ast-grep', 'rules')).filter(file =>
    file.endsWith('.yml')
  ).length
}

/**
 * Ids declared by registry modules.
 *
 * Matched anywhere in the file rather than at line start, so reformatting an entry
 * inline cannot silently shrink the count. Test files are `*-commands.test.ts` and
 * fall outside the glob instead of double-counting the assertions they contain.
 */
export function registryCommands(root) {
  const dir = join(root, 'src/lib/commands')
  return walk(dir)
    .filter(file => /-commands\.ts$/.test(file))
    .reduce(
      (total, file) =>
        total + (readFileSync(file, 'utf8').match(/id:\s*'/g) ?? []).length,
      0
    )
}

/**
 * Steps chained by `npm run check:all`, which is what "N+ quality gates" means:
 * a forker can run them all with one command only if they are all in there.
 */
export function qualityGates(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  return pkg.scripts['check:all'].split('&&').length
}

/** Rust integration test files under `src-tauri/tests/`. */
export function rustIntegrationTests(root) {
  return readdirSync(join(root, 'src-tauri/tests')).filter(file =>
    file.endsWith('_integration.rs')
  ).length
}

/** Tauri capability files — the permission surface a forker inherits. */
export function capabilityFiles(root) {
  return readdirSync(join(root, 'src-tauri/capabilities')).filter(file =>
    file.endsWith('.json')
  ).length
}

export function measureCounts(root) {
  return {
    developerDocs: developerDocs(root),
    docsMarkdownFiles: docsMarkdownFiles(root),
    astRules: astRules(root),
    registryCommands: registryCommands(root),
    qualityGates: qualityGates(root),
    rustIntegrationTests: rustIntegrationTests(root),
    capabilityFiles: capabilityFiles(root),
  }
}
