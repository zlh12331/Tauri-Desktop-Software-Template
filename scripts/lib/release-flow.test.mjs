/**
 * Tests for the release flow decisions.
 *
 * These cover the two shapes that strand a release: tagging a version that is
 * not actually on `main`, and tagging a version that already exists. Both used
 * to be one command's worth of trust (`git push origin main --tags`), which a
 * protected `main` turns into a half-finished release.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { decideTag, releaseBranch } from './release-flow.mjs'

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
