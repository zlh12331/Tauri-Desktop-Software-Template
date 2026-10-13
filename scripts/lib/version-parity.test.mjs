/**
 * Tests for the version-parity rules.
 *
 * The interesting cases are all "the reader silently grabbed the wrong line":
 * a dependency pin read as the package version, a lockfile entry for some other
 * crate, a comparison that passes because one side was never found.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractCargoVersion,
  extractLockedVersion,
  findMismatches,
  highestTag,
  isDuplicateOfTag,
  isGreater,
} from './version-parity.mjs'

const CARGO_TOML = `[package]
name = "tauri_app"
version = "0.1.2"
edition = "2024"

[lib]
name = "tauri_app_lib"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "2" }
`

test('reads the package version, not a dependency pin', () => {
  assert.equal(extractCargoVersion(CARGO_TOML), '0.1.2')
})

test('stops at the next table so a later version line cannot win', () => {
  const withTrailing = `${CARGO_TOML}\n[[bin]]\nname = "x"\nversion = "9.9.9"\n`
  assert.equal(extractCargoVersion(withTrailing), '0.1.2')
})

test('a package block without a version reads as missing, not empty', () => {
  assert.equal(extractCargoVersion('[package]\nname = "x"\n'), null)
  assert.equal(extractCargoVersion('[dependencies]\nserde = "1"\n'), null)
})

test('tolerates CRLF line endings', () => {
  assert.equal(
    extractCargoVersion('[package]\r\nname = "x"\r\nversion = "2.3.4"\r\n'),
    '2.3.4'
  )
})

test('lockfile lookup is scoped to this crate', () => {
  const lock = `[[package]]
name = "other"
version = "5.0.0"

[[package]]
name = "tauri_app"
version = "0.1.2"
`
  assert.equal(extractLockedVersion(lock, 'tauri_app'), '0.1.2')
  assert.equal(extractLockedVersion(lock, 'absent'), null)
})

test('parity passes when all four agree', () => {
  const versions = {
    'package.json': '0.1.2',
    'tauri.conf.json': '0.1.2',
    'Cargo.toml': '0.1.2',
    'Cargo.lock': '0.1.2',
  }
  assert.deepEqual(findMismatches(versions), [])
})

test('a drifted file is named with both values', () => {
  const mismatches = findMismatches({
    a: '0.1.2',
    b: '0.1.2',
    c: '0.1.3',
  })
  assert.deepEqual(mismatches, ['c (0.1.3) vs 0.1.2'])
})

test('a version that could not be read never counts as matching', () => {
  const mismatches = findMismatches({
    a: '0.1.2',
    b: null,
  })
  assert.deepEqual(mismatches, ['b (not found) vs 0.1.2'])
  assert.deepEqual(findMismatches({ a: null, b: null }), ['a', 'b'])
})

test('tag comparison ignores the leading v on either side', () => {
  const tags = ['v0.1.1', 'v0.1.2']
  assert.equal(isDuplicateOfTag('0.1.2', tags), true)
  assert.equal(isDuplicateOfTag('v0.1.2', tags), true)
  assert.equal(isDuplicateOfTag('0.1.3', tags), false)
})

test('version ordering is numeric, not lexical', () => {
  assert.equal(isGreater('0.1.10', '0.1.9'), true)
  assert.equal(isGreater('0.1.9', '0.1.10'), false)
  assert.equal(isGreater('1.0.0', '0.9.9'), true)
  assert.equal(isGreater('0.1.2', '0.1.2'), false, 'equal is not greater')
  assert.equal(isGreater('0.2.0', '0.10.0'), false)
})

test('an unparseable or missing baseline never reads as newer', () => {
  assert.equal(isGreater('0.1.2', null), false)
  assert.equal(isGreater('beta', '0.1.2'), false)
})

test('highestTag finds the real maximum instead of reporting none', () => {
  // The regression this pins: reducing with `isGreater(v, null) === false` over a
  // list seeded with null never adopted the first element, so the pre-release
  // guard said "origin has no tags yet" for a repository that had v0.1.1 and
  // would have accepted re-cutting it.
  assert.equal(highestTag(['v0.1.0', 'v0.1.1']), '0.1.1')
  assert.equal(highestTag(['v0.1.1', 'v0.1.0']), '0.1.1')
  assert.equal(highestTag(['v0.1.9', 'v0.1.10']), '0.1.10')
  assert.equal(highestTag([]), null)
})

test('highestTag ignores non-version refs', () => {
  assert.equal(
    highestTag([
      'archive/session-2026-09-19',
      'v0.1.1',
      'nightly',
      'v0.2.0-beta.1',
    ]),
    '0.1.1'
  )
})
