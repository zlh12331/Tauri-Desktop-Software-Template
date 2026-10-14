/**
 * Running the real ast-grep binary over generated fixture trees.
 *
 * Two suites need this: the contract pairs (one violating + one compliant snippet
 * per rule) and the store-coverage sweep (the same violation planted once per
 * store). Sharing the harness keeps them answering the same question with the same
 * binary, so a fix to how the scanner is invoked cannot land in one suite and be
 * missed in the other.
 *
 * Trees are generated under `node_modules/.cache` and removed afterwards. A
 * committed anti-pattern would fail `ast:lint`, ESLint and cspell for everyone, and
 * the gate would be defeated by the thing that tests it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

// `node_modules/@ast-grep/cli/ast-grep` is a JS shim only on win32: on Unix the
// package's postinstall replaces that file with the native binary, and handing a
// binary to `node` exits 1 with a SyntaxError — which a harness would then read
// as "the scanner ran, and saw nothing". Ask the package where its own binary
// lives and exec that, so one invocation serves win32, linux and darwin.
let bin = null
export function binaryPath() {
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

/** The CLI version under test, as `x.y.z`. */
export function version() {
  const probe = spawnSync(binaryPath(), ['--version'], { encoding: 'utf8' })
  assertProbe(probe)
  const found = /ast-grep (\d+\.\d+\.\d+)/.exec(probe.stdout)
  if (!found) {
    throw new Error(
      `unexpected version line: ${(probe.stdout ?? '').slice(0, 200)}`
    )
  }
  return found[1]
}

function assertProbe(probe) {
  if (probe.error) {
    throw new Error(`ast-grep could not be executed: ${probe.error.message}`)
  }
  if (probe.status !== 0) {
    throw new Error(
      `ast-grep --version exited ${probe.status}: ${(probe.stderr || probe.stdout || '').slice(0, 300)}`
    )
  }
}

/**
 * Build a throwaway source tree carrying the live rules, and scan trees inside it.
 *
 * `scan` accepts only the two exit codes a working scanner produces: 0 means clean,
 * 1 means findings. Anything else is a broken scanner, and a broken scanner must
 * never be able to read as either verdict — that conflation is what once made six
 * rules look dead when the harness was handing node an ELF to interpret.
 */
export function createScanner({ root, cacheDir }) {
  function buildTree(name, fixtures) {
    const dir = path.join(cacheDir, name)
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
    for (const fixture of fixtures) {
      const target = path.join(dir, fixture.path)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, fixture.code)
    }
    return dir
  }

  function scan(dir) {
    const result = spawnSync(
      binaryPath(),
      ['scan', '--config', path.join(dir, 'sgconfig.yml'), '--json', dir],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
    if (result.error) {
      throw new Error(`ast-grep could not be executed: ${result.error.message}`)
    }
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(
        `ast-grep scan exited ${result.status}: ${(result.stderr || result.stdout || '').slice(0, 400)}`
      )
    }
    return result.stdout ?? ''
  }

  function clean() {
    fs.rmSync(cacheDir, { recursive: true, force: true })
  }

  return { buildTree, scan, clean, cacheDir }
}

/**
 * The store-name matcher a rule file declares, read from the rule rather than
 * duplicated here.
 *
 * A coverage test that hardcodes the pattern it is checking would pass while the
 * rule narrows. Returns `null` when the rule has no such constraint at all — which
 * is how a rule pinned to one literal store name shows up.
 */
export function declaredStoreMatcher(ruleSource) {
  // Tolerant of indentation rather than assuming the block sits at column 0: an
  // earlier version anchored on line ends here and matched an empty block, so both
  // rules read as "no matcher declared" — a false accusation that would have been
  // fixed by loosening the test instead of correcting the parser.
  const declared =
    /constraints:\s*\n\s+([A-Z][A-Z0-9_]*):\s*\n\s+regex:\s*'([^']+)'/m.exec(
      ruleSource
    )
  return declared
    ? { variable: declared[1], regex: new RegExp(declared[2]) }
    : null
}

/** Every store hook exported from `src/store/`, read from the source of truth. */
export function discoveredStores(root) {
  const dir = path.join(root, 'src', 'store')
  const found = []
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue
    const source = fs.readFileSync(path.join(dir, entry), 'utf8')
    for (const match of source.matchAll(
      /^export const (use[A-Za-z0-9_]+) = create</gm
    )) {
      found.push({ name: match[1], file: `src/store/${entry}` })
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name))
}
