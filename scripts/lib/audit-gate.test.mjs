/**
 * Tests for the npm audit gate's decision logic.
 *
 * These exist because a gate that only ever passes proves nothing. The original
 * implementation compared severities against an undefined rank, so it accepted
 * every input including a genuinely vulnerable tree; the "empty exemption list
 * must report the packages" case below is the direct guard against a repeat.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_THRESHOLD,
  RANK,
  buildAuditCommand,
  effectiveSeverity,
  evaluate,
  validatePassthrough,
} from './audit-gate.mjs'

const BRACES_GHSA = 'GHSA-vfj7-8cjw-p6xm'
const advisory = (ghsa, severity) => ({
  url: `https://github.com/advisories/${ghsa}`,
  severity,
  title: `${ghsa} test advisory`,
})

/** braces <- micromatch <- fast-glob, all reported high by npm. */
const chain = extra => ({
  braces: {
    name: 'braces',
    severity: 'high',
    range: '<=3.0.3',
    via: [advisory(BRACES_GHSA, 'high')],
  },
  micromatch: {
    name: 'micromatch',
    severity: 'high',
    range: '4.0.8',
    via: ['braces'],
  },
  'fast-glob': {
    name: 'fast-glob',
    severity: 'high',
    range: '3.3.2',
    via: ['micromatch', ...(extra ? [extra] : [])],
  },
})

const exemption = { ghsa: BRACES_GHSA, pkg: 'braces' }

test('the whole dependents chain is outstanding when nothing is exempted', () => {
  // This is the case the undefined-rank bug got wrong forever.
  const { outstanding } = evaluate(chain(), [])
  assert.deepEqual(
    [...outstanding].sort(),
    ['braces', 'fast-glob', 'micromatch'],
    'a high leaf must propagate to every dependent'
  )
})

test('a documented exemption clears the chain it explains', () => {
  const { outstanding, exempted, severityOf } = evaluate(chain(), [exemption])
  assert.deepEqual(outstanding, [])
  assert.ok(exempted.has('braces@<=3.0.3'), 'exemption is reported as used')
  // The report shows what the gate measured, not npm's chain-wide headline.
  assert.equal(severityOf.get('braces'), 'none')
  assert.equal(severityOf.get('fast-glob'), 'none')
})

test('exemption recomputes severity instead of dropping the package', () => {
  // fast-glob keeps its own moderate advisory once the exempted high leaf goes.
  const { outstanding, exempted } = evaluate(
    chain(advisory('GHSA-moderate-leaf', 'moderate')),
    [exemption]
  )
  assert.deepEqual(outstanding, [], 'moderate sits below the high threshold')
  assert.equal(
    effectiveSeverity(
      'fast-glob',
      chain(advisory('GHSA-moderate-leaf', 'moderate')),
      new Map([[BRACES_GHSA, exemption]])
    ),
    'moderate',
    'falls back to the remaining cause rather than to none'
  )
  assert.ok(exempted.has('braces@<=3.0.3'))
})

test('threshold is comparable at every rank', () => {
  for (const rank of ['low', 'moderate', 'high', 'critical']) {
    assert.ok(RANK[rank] > RANK.none, `${rank} must outrank none`)
  }
  assert.equal(
    RANK.none,
    0,
    'none needs a real rank or every comparison is false'
  )
})

test('a cycle in the dependency chain terminates', () => {
  // npm's `via` edges are not a tree: a depends on b and b reports a.
  const cyclic = {
    a: { name: 'a', severity: 'high', range: '1.0.0', via: ['b'] },
    b: {
      name: 'b',
      severity: 'high',
      range: '2.0.0',
      via: ['a', advisory('GHSA-real-leaf', 'high')],
    },
  }
  const ignored = new Map()
  assert.doesNotThrow(() => effectiveSeverity('a', cyclic, ignored))
  assert.equal(
    effectiveSeverity('a', cyclic, ignored),
    'high',
    'the leaf advisory still reaches the root through the cycle'
  )
})

test('a pure cycle with no leaf advisory resolves to none', () => {
  const cyclic = {
    a: { name: 'a', severity: 'high', range: '1.0.0', via: ['b'] },
    b: { name: 'b', severity: 'high', range: '2.0.0', via: ['a'] },
  }
  assert.doesNotThrow(() =>
    assert.equal(effectiveSeverity('a', cyclic, new Map()), 'none')
  )
})

test('an unknown threshold fails loudly instead of accepting everything', () => {
  assert.throws(
    () => evaluate(chain(), [], 'highest'),
    /unknown threshold 'highest'/
  )
})

test('the default threshold is high', () => {
  assert.equal(DEFAULT_THRESHOLD, 'high')
  // A low-severity tree alone must not trip it.
  const low = {
    leftpad: {
      name: 'leftpad',
      severity: 'low',
      range: '1.0.0',
      via: [advisory('GHSA-low', 'low')],
    },
  }
  assert.deepEqual(evaluate(low, []).outstanding, [])
})

test('an exemption whose package is gone is reported as stale debt', () => {
  const { stale } = evaluate({ unrelated: { via: [] } }, [exemption])
  assert.deepEqual(stale, [BRACES_GHSA])
})

test('a package absent from the report has no effective severity', () => {
  assert.equal(effectiveSeverity('ghost', {}, new Map()), 'none')
})

test('passthrough args are limited to a boring key=value charset', () => {
  assert.deepEqual(
    validatePassthrough(['--registry=https://registry.npmjs.org']),
    ['--registry=https://registry.npmjs.org']
  )
  for (const bad of [
    '--registry=https://x.example/ ; rm -rf /',
    '--foo=bar --baz',
    '-Dsomething',
    '--pkg="quoted"',
    '--flag-only',
  ]) {
    assert.throws(
      () => validatePassthrough([bad]),
      /refusing unexpected argument/,
      `${bad} must not reach a shell`
    )
  }
})

test('npm_execpath is preferred so no shell is needed', () => {
  const cmd = buildAuditCommand({
    extra: ['--registry=https://registry.npmjs.org'],
    env: {
      npm_execpath: 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
    },
    execPath: 'C:/Program Files/nodejs/node.exe',
    platform: 'win32',
  })
  assert.equal(cmd.shell, false, 'spawning node with a JS entry needs no shell')
  assert.equal(cmd.command, 'C:/Program Files/nodejs/node.exe')
  assert.deepEqual(cmd.args, [
    'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
    'audit',
    '--json',
    '--registry=https://registry.npmjs.org',
  ])
})

test('without npm_execpath the npm shim falls back per platform', () => {
  // env must be an explicitly empty object. Passing `npm_execpath: undefined`
  // used to re-read the real environment through the default parameter, so this
  // case passed under `node --test` and failed inside `npm run`, where
  // npm_execpath is always set.
  assert.deepEqual(
    buildAuditCommand({ env: {}, platform: 'win32' }),
    { command: 'npm', args: ['audit', '--json'], shell: true },
    'npm is a .cmd shim on Windows and Node refuses to spawn one without a shell'
  )
  assert.equal(
    buildAuditCommand({ env: {}, platform: 'linux' }).shell,
    false,
    'posix needs no shell'
  )
})

test('a non-JS npm_execpath is not treated as an entry point', () => {
  const cmd = buildAuditCommand({
    env: { npm_execpath: '/usr/local/bin/npm' },
    platform: 'linux',
  })
  assert.equal(cmd.command, 'npm')
  assert.equal(cmd.shell, false)
})
