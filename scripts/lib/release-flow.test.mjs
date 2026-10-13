/**
 * Tests for the release flow decisions.
 *
 * These cover the two shapes that strand a release: tagging a version that is
 * not actually on `main`, and tagging a version that already exists. Both used
 * to be one command's worth of trust (`git push origin main --tags`), which a
 * protected `main` turns into a half-finished release.
 *
 * `bumpLockfileVersions` is covered because the lockfile copy of the version used
 * to be refreshed by a nested `npm install`, which aborts on a maintainer's
 * unrelated npm config, and because a silent rewrite would hide a lock that
 * already drifted.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bumpLockfileVersions,
  decideTag,
  releaseBranch,
} from './release-flow.mjs'

const clean = {
  'package.json': '0.2.0',
  'tauri.conf.json': '0.2.0',
  'Cargo.toml': '0.2.0',
  'Cargo.lock': '0.2.0',
}

test('an ordinary release is accepted', () => {
  const d = decideTag({ target: '0.2.0', manifests: clean, tags: ['v0.1.1'] })
  assert.equal(d.ok, true)
})

test('a version that is not on main yet is refused, naming what was found', () => {
  const d = decideTag({
    target: '0.2.0',
    manifests: { ...clean, 'Cargo.toml': '0.1.2' },
    tags: [],
  })
  assert.equal(d.ok, false)
  assert.match(d.reason, /Cargo\.toml=0\.1\.2/)
  assert.match(d.reason, /pull request merged/)
})

test('a manifest we cannot read is a refusal, not a default', () => {
  const d = decideTag({
    target: '0.2.0',
    manifests: { ...clean, 'Cargo.lock': null },
    tags: [],
  })
  assert.equal(d.ok, false)
  assert.match(d.reason, /Cargo\.lock=missing/)
})

test('an entirely unreadable main refuses to tag', () => {
  const d = decideTag({ target: '0.2.0', manifests: {}, tags: [] })
  assert.equal(d.ok, false)
  assert.match(d.reason, /cannot verify/)
  assert.equal(
    decideTag({ target: '0.2.0', manifests: null, tags: [] }).ok,
    false
  )
})

test('a version that already has a tag is refused either spelling', () => {
  assert.equal(
    decideTag({ target: '0.2.0', manifests: clean, tags: ['v0.2.0'] }).ok,
    false
  )
  assert.equal(
    decideTag({ target: '0.2.0', manifests: clean, tags: ['0.2.0'] }).ok,
    false
  )
})

test('a malformed target is refused before anything is read', () => {
  for (const bad of ['2.0', 'v2.0.0-beta', 'main', '', undefined]) {
    const d = decideTag({ target: bad, manifests: clean, tags: [] })
    assert.equal(d.ok, false, `${bad} should not be taggable`)
  }
})

test('the branch name carries the v prefix exactly once', () => {
  assert.equal(releaseBranch('v0.2.0'), 'release/v0.2.0')
  assert.equal(releaseBranch('0.2.0'), 'release/v0.2.0')
})

const lock3 = (version, rootVersion = version) =>
  JSON.stringify(
    {
      name: 'app',
      version,
      lockfileVersion: 3,
      packages: {
        '': { name: 'app', version: rootVersion },
        'node_modules/a': { version: '1.0.0' },
      },
    },
    null,
    2
  )

const bump = text =>
  bumpLockfileVersions(text, { currentVersion: '0.1.2', nextVersion: '0.1.3' })

test('both lockfile copies of the version are rewritten and nothing else moves', () => {
  const r = bump(lock3('0.1.2'))
  assert.equal(r.ok, true)
  const lock = JSON.parse(r.text)
  assert.equal(lock.version, '0.1.3')
  assert.equal(lock.packages[''].version, '0.1.3')
  assert.equal(lock.packages['node_modules/a'].version, '1.0.0')
  assert.deepEqual([...r.updated].sort(), [
    'packages[""].version',
    'top-level "version"',
  ])
})

test('a lockfile that already drifted is refused instead of overwritten', () => {
  const r = bump(lock3('0.1.2', '0.1.0'))
  assert.equal(r.ok, false)
  assert.match(r.reason, /packages\[""\]\.version=0\.1\.0/)
  assert.match(r.reason, /npm install/)
})

test('a lockfile holding only the top-level version is still updated', () => {
  const r = bump(
    JSON.stringify({ name: 'app', version: '0.1.2', lockfileVersion: 1 })
  )
  assert.equal(r.ok, true)
  assert.deepEqual(r.updated, ['top-level "version"'])
})

test('an unreadable or unrecognised lockfile is a refusal, not a default', () => {
  assert.equal(bump('{ not json').ok, false)
  const noVersion = bump(JSON.stringify({ name: 'app', lockfileVersion: 3 }))
  assert.equal(noVersion.ok, false)
  assert.match(noVersion.reason, /no version field/)
})
