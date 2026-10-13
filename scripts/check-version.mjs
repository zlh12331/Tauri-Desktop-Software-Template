#!/usr/bin/env node
/**
 * Version-parity gate.
 *
 * One release version is written into four files by `scripts/prepare-release.js`.
 * This asserts they still agree, and in `--pre-release` mode also refuses to cut
 * a version that already has a tag.
 *
 *   node scripts/check-version.mjs                      # CI / local parity check
 *   node scripts/check-version.mjs --pre-release v0.2.0 # before cutting a release
 *
 * With `--pre-release` and no version argument, the manifest version is checked —
 * useful on main, wrong as a pre-flight, since the files still hold the previous
 * release at that moment.
 *
 * Why both modes are not one: after a release lands, the manifests legitimately
 * equal the newest tag until the next bump. Treating that as drift would redden
 * every CI run on main between releases. Parity is the always-on invariant;
 * "strictly newer than any existing tag" is a pre-flight, because a duplicated
 * version strands the release — the updater endpoint is
 * `/releases/latest/download/latest.json`, which follows the newest tag, so a
 * second `v0.1.2` overwrites the first or leaves its artifacts unreachable.
 *
 * Exit code 0 = consistent, 1 = mismatch, unreadable file, or a reused version.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import {
  extractCargoVersion,
  extractLockedVersion,
  findMismatches,
  highestTag,
  isDuplicateOfTag,
  isGreater,
} from './lib/version-parity.mjs'

const root = process.cwd()
const preRelease = process.argv.includes('--pre-release')

/**
 * The version to test against the published tags. Required for a pre-flight,
 * because at that moment the files on disk still carry the *previous* release:
 * comparing them would check the wrong version and say nothing about the one
 * about to be cut. Falls back to the manifest when no argument is given, which
 * is the right default for "is main internally consistent".
 */
const target =
  process.argv.find(arg => /^v?\d+\.\d+\.\d+$/.test(arg))?.replace(/^v/, '') ??
  null

const read = rel => {
  const path = join(root, rel)
  if (!existsSync(path)) {
    console.error(`✖ missing file: ${rel}`)
    process.exit(1)
  }
  return readFileSync(path, 'utf8')
}

const pkgJson = JSON.parse(read('package.json'))
const tauriConf = JSON.parse(read('src-tauri/tauri.conf.json'))
const cargoToml = read('src-tauri/Cargo.toml')
const cargoLock = read('src-tauri/Cargo.lock')

const readings = {
  'package.json': pkgJson.version ?? null,
  'src-tauri/tauri.conf.json': tauriConf.version ?? null,
  'src-tauri/Cargo.toml [package]': extractCargoVersion(cargoToml),
  'src-tauri/Cargo.lock (this crate)': extractLockedVersion(
    cargoLock,
    pkgJson.name ?? 'tauri-desktop-software-template'
  ),
}

console.log('Version parity:')
for (const [label, value] of Object.entries(readings)) {
  console.log(`  ${label.padEnd(34)} ${value ?? 'NOT FOUND'}`)
}

const mismatches = findMismatches(readings)
const version = pkgJson.version
const checkedVersion = target ?? version

if (mismatches.length > 0) {
  console.error(
    `\n✖ the release version is not identical across the four places it is written:`
  )
  for (const m of mismatches) console.error(`  ${m}`)
  console.error(
    '\n  Run `npm run release:prepare -- v<version>` to rewrite them together,' +
      ' or fix the file that drifted.'
  )
  process.exit(1)
}

if (preRelease) {
  // Ask the remote, not the local clone: a stale checkout that has never fetched
  // tags would report "no releases yet" and wave through a duplicate version.
  // ls-remote is a read-only network call; a failure to reach origin is an error
  // rather than an empty list, because those two look identical downstream.
  let tags
  let source = 'origin'
  try {
    tags = execFileSync('git', ['ls-remote', '--tags', 'origin'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map(line => (line.split('\t')[1] ?? '').replace('refs/tags/', ''))
      .filter(tag => tag !== '' && !tag.endsWith('^{}'))
  } catch {
    console.error(
      '✖ cannot read tags from origin. The pre-release check needs them: an empty ' +
        'tag list and an unreachable remote must not look the same.'
    )
    process.exit(1)
  }

  if (isDuplicateOfTag(checkedVersion, tags)) {
    console.error(
      `✖ v${checkedVersion} already exists on origin. Re-cutting it strands the ` +
        'release: the updater fetches /releases/latest/download/latest.json, ' +
        'which follows the newest tag, so the artifacts of the two versions ' +
        'cannot both be reachable. Bump the version instead.'
    )
    process.exit(1)
  }

  const newest = highestTag(tags)

  if (newest !== null && !isGreater(checkedVersion, newest)) {
    console.error(
      `✖ v${checkedVersion} is not newer than the highest existing tag v${newest} on ${source}. ` +
        'A release that does not advance the version will not reach anyone.'
    )
    process.exit(1)
  }

  console.log(
    `\nPre-release check: v${checkedVersion} is unique and newer than ${newest ? `v${newest}` : 'any published tag (origin has none yet)'}`
  )
} else {
  console.log('\n✓ all four version fields agree')
}
