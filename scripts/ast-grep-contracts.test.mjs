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
import { createRequire } from 'node:module'
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

// `node_modules/@ast-grep/cli/ast-grep` is a JS shim only on win32: on Unix the
// package's postinstall replaces that file with the native binary, and handing a
// binary to `node` exits 1 with a SyntaxError — which this suite would then read
// as "the scanner ran, and saw nothing". Ask the package where its own binary
// lives and exec that, so one invocation serves win32, linux and darwin.
let bin = null
function astGrep() {
  if (bin) return bin
  const req = createRequire(import.meta.url)
  let resolveBinaryPath
  try {
    ;({ resolveBinaryPath } = req('@ast-grep/cli/postinstall.js'))
  } catch (cause) {
    throw new Error(
      `cannot load the @ast-grep/cli binary resolver: ${cause.message}`
    )
  }
  bin = resolveBinaryPath()
  if (!bin) {
    throw new Error(
      'ast-grep native binary is missing — optional dependencies were skipped at install'
    )
  }
  return bin
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
    astGrep(),
    ['scan', '--config', path.join(dir, 'sgconfig.yml'), '--json', dir],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  if (result.error) {
    throw new Error(`ast-grep could not be executed: ${result.error.message}`)
  }
  // 0 = clean, 1 = findings. Anything else means the scanner itself failed, and a
  // broken scanner must not be able to read as either of those.
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `ast-grep scan exited ${result.status}: ${(result.stderr || result.stdout || '').slice(0, 400)}`
    )
  }
  return result.stdout ?? ''
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

test('the scanner is alive, and is the version the lockfile pins', () => {
  const probe = spawnSync(astGrep(), ['--version'], { encoding: 'utf8' })
  assert.equal(
    probe.status,
    0,
    `ast-grep --version exited ${probe.status}: ${(probe.stderr || '').slice(0, 300)}`
  )
  const found = /ast-grep (\d+\.\d+\.\d+)/.exec(probe.stdout)
  assert.ok(found, `unexpected version line: ${probe.stdout.slice(0, 200)}`)
  // Contracts describe one CLI version; judging them with another proves nothing
  // about what CI runs. An install can lag the lockfile for weeks — with npm 12
  // blocking postinstall nothing ever forces the package's binary into place, so
  // the staleness is invisible until a verdict diverges between machines.
  const running = found[1]
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
  const output = scan(buildTree('bad'))
  const counts = countFindings(output)
  const { missing, extra, wrongCount } = diffCounts(
    counts,
    expectedCounts('bad')
  )
  assert.deepEqual(
    missing,
    [],
    `rules that matched nothing are silent failures (binary: ${astGrep()})\n${output.slice(0, 600)}`
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
