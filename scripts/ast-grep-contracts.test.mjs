/**
 * Contracts for the ast-grep architecture rules, run against the real binary.
 *
 * `ast-grep scan` reporting zero findings looks identical to a rule that stopped
 * matching: a CLI upgrade, an edited pattern, or a `files:` glob that no longer
 * covers the directory it guards. Each rule in `scripts/lib/ast-grep-contracts.mjs`
 * therefore carries one snippet that must fire and one that must not, so emptiness
 * is checked against the detector instead of against the repo.
 *
 * A contract proves the rule bites the fixture it was written against. That it
 * bites everything the rule *claims* to guard is a different claim — see
 * `ast-grep-store-coverage.test.mjs`, which plants the same violation once per
 * store. `no-destructure-zustand` passed every contract while hardcoded to one
 * store, which is why both suites exist.
 *
 * Reached through `npm run test:scripts`, which `check:all` and CI both execute, so
 * this needs no workflow change.
 */
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CONTRACTS,
  contractGaps,
  countFindings,
  diffCounts,
  expectedCounts,
} from './lib/ast-grep-contracts.mjs'
import { createScanner, version } from './lib/ast-grep-scan.mjs'

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scanner = createScanner({
  root,
  cacheDir: path.join(root, 'node_modules', '.cache', 'ast-grep-contracts'),
})

function ruleIdsOnDisk() {
  const ids = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (/\.ya?ml$/.test(entry.name)) {
        const match = /^id:\s*(\S+)$/m.exec(fs.readFileSync(p, 'utf8'))
        if (match) ids.push(match[1])
      }
    }
  }
  walk(path.join(root, '.ast-grep', 'rules'))
  return ids
}

function buildTree(kind) {
  return scanner.buildTree(
    kind,
    CONTRACTS.map(contract => (kind === 'bad' ? contract.bad : contract.good))
  )
}

after(() => scanner.clean())

test('every architecture rule on disk has a contract, and no contract is stale', () => {
  const { uncontracted, staleRules } = contractGaps(ruleIdsOnDisk())
  assert.deepEqual(
    uncontracted,
    [],
    'these rules have no violating/compliant fixture, so this gate proves nothing about them'
  )
  assert.deepEqual(
    staleRules,
    [],
    'contracts reference rule ids that no longer exist'
  )
})

test('the scanner is alive, and is the version the lockfile pins', () => {
  // Contracts describe one CLI version; judging them with another proves nothing
  // about what CI runs. An install can lag the lockfile for weeks — with npm 12
  // blocking postinstall nothing ever forces the package's binary into place, so
  // the staleness is invisible until a verdict diverges between machines.
  const running = version()
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')
  )
  const pinned = lock.packages?.['node_modules/@ast-grep/cli']?.version
  assert.ok(pinned, 'package-lock.json carries no @ast-grep/cli entry')
  assert.equal(
    running,
    pinned,
    `ast-grep installed reports ${running} but the lockfile pins ${pinned} — run npm install before trusting this suite`
  )
})

test('the violating tree makes every rule fire exactly once', () => {
  const output = scanner.scan(buildTree('bad'))
  const counts = countFindings(output)
  const { missing, extra, wrongCount } = diffCounts(
    counts,
    expectedCounts('bad')
  )
  assert.deepEqual(
    missing,
    [],
    `rules that matched nothing are silent failures (binary: ${scanner.cacheDir})\n${output.slice(0, 600)}`
  )
  assert.deepEqual(extra, [])
  assert.deepEqual(wrongCount, [])
})

test('the compliant tree makes no rule fire', () => {
  const counts = countFindings(scanner.scan(buildTree('good')))
  const { extra } = diffCounts(counts, expectedCounts('good'))
  assert.deepEqual(extra, [])
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  assert.equal(total, 0, 'allowed forms must not be reported')
})

test('the fixtures are only ever written under node_modules/.cache', () => {
  assert.ok(scanner.cacheDir.includes(path.join('node_modules', '.cache')))
  assert.equal(
    CONTRACTS.every(c => !fs.existsSync(path.join(root, c.bad.path))),
    true,
    'a violating fixture must not exist in the working tree'
  )
})
