/**
 * Runs the ast-grep contracts against the real binary.
 *
 * Fixtures are generated into `node_modules/.cache` and removed afterwards, so
 * the violating snippets never exist in the working tree — a committed anti-pattern
 * would fail `ast:lint`, eslint and cspell for everyone, and the gate would be
 * defeated by the thing that tests it.
 *
 * Reached through `npm run test:scripts`, which `check:all` and CI both execute, so
 * this needs no workflow change.
 */
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  CONTRACTS,
  contractGaps,
  countFindings,
  diffCounts,
  expectedCounts,
} from './lib/ast-grep-contracts.mjs'

const root = process.cwd()
const tmp = path.join(root, 'node_modules', '.cache', 'ast-grep-contracts')

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

// The package's own launcher is a JS shim that resolves the platform binary, which
// keeps this working on win32 (no shell), macOS and the musl builds alike.
function launcher() {
  const p = path.join(root, 'node_modules', '@ast-grep', 'cli', 'ast-grep')
  if (!fs.existsSync(p)) {
    throw new Error(`ast-grep launcher missing at ${p} — run npm install`)
  }
  return p
}

function buildTree(kind) {
  const dir = path.join(tmp, kind)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.cpSync(
    path.join(root, '.ast-grep', 'rules'),
    path.join(dir, '.ast-grep', 'rules'),
    { recursive: true }
  )
  fs.copyFileSync(
    path.join(root, 'sgconfig.yml'),
    path.join(dir, 'sgconfig.yml')
  )
  for (const contract of CONTRACTS) {
    const fixture = kind === 'bad' ? contract.bad : contract.good
    const target = path.join(dir, fixture.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, fixture.code)
  }
  return dir
}

function scan(dir) {
  const result = spawnSync(
    process.execPath,
    [
      launcher(),
      'scan',
      '--config',
      path.join(dir, 'sgconfig.yml'),
      '--report-style',
      'short',
      dir,
    ],
    { encoding: 'utf8' }
  )
  // 0 = clean, 1 = findings. Anything else means the scanner itself failed, and a
  // broken scanner must not be able to read as either of those.
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `ast-grep scan exited ${result.status}: ${(result.stderr || result.stdout || '').slice(0, 400)}`
    )
  }
  if (result.error) throw result.error
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`
}

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

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

test('the violating tree makes every rule fire exactly once', () => {
  const counts = countFindings(scan(buildTree('bad')))
  const { missing, extra, wrongCount } = diffCounts(
    counts,
    expectedCounts('bad')
  )
  assert.deepEqual(
    missing,
    [],
    'rules that matched nothing are silent failures'
  )
  assert.deepEqual(extra, [])
  assert.deepEqual(wrongCount, [])
})

test('the compliant tree makes no rule fire', () => {
  const counts = countFindings(scan(buildTree('good')))
  const { extra } = diffCounts(counts, expectedCounts('good'))
  assert.deepEqual(extra, [])
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  assert.equal(total, 0, 'allowed forms must not be reported')
})

test('the fixtures are only ever written under node_modules/.cache', () => {
  assert.ok(tmp.includes(path.join('node_modules', '.cache')))
  assert.equal(
    CONTRACTS.every(c => !fs.existsSync(path.join(root, c.bad.path))),
    true,
    'a violating fixture must not exist in the working tree'
  )
})
